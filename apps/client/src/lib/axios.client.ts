import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Tạo instance axios mặc định cho client
export const axiosClient = axios.create({
  // Mọi request từ Frontend sẽ tự động đi qua "Cổng Proxy" của Next.js thay vì gọi thẳng Backend
  baseURL: '/api/proxy',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Trạng thái khóa (lock) để tránh gọi Refresh Token nhiều lần cùng lúc
let isRefreshing = false;

// Hàng đợi In-memory: Lưu giữ các request bị lỗi 401 tạm thời trong lúc chờ token mới
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

// Hàm xử lý hàng đợi sau khi Refresh Token xong (thành công hoặc thất bại)
const processQueue = (error: Error | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error); // Báo lỗi cho các request đang chờ
    } else {
      prom.resolve(); // Báo thành công, cho phép request tiếp tục chạy
    }
  });
  // Xóa trắng hàng đợi
  failedQueue = [];
};

// Response Interceptor: Tự động chặn và xử lý mọi response trả về
axiosClient.interceptors.response.use(
  (response) => response, // Nếu gọi thành công (200), trả về dữ liệu bình thường
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Chỉ can thiệp nếu lỗi là 401 (Unauthorized) và request này chưa từng được retry
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        // Đang có 1 tiến trình xin cấp lại Token chạy rồi, các request 401 khác phải vào Hàng đợi (Queue)
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Khi Refresh thành công, tiến trình báo resolve() -> Gọi lại request gốc
            return axiosClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      // Đánh dấu request này đang được retry để không lặp vô hạn
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Kích hoạt API xin cấp lại Token
        // Chú ý: Gọi thẳng route /api/auth/refresh (không gọi qua /api/proxy)
        await axios.get('/api/auth/refresh');

        // Lấy token thành công -> Mở khóa và cho phép các request trong hàng đợi chạy lại
        isRefreshing = false;
        processQueue(null);

        // Chạy lại chính request ban đầu vừa bị lỗi
        return axiosClient(originalRequest);
      } catch (refreshError) {
        // Lấy token thất bại (refresh_token cũng hết hạn luôn)
        isRefreshing = false;
        processQueue(refreshError as Error); // Đánh sập tất cả các request trong hàng đợi

        // Chuyển hướng người dùng về trang Đăng nhập
        if (typeof window !== 'undefined') {
          window.location.href = '/auth/login?session_expired=true';
        }

        return Promise.reject(refreshError);
      }
    }

    // Các lỗi khác (400, 403, 500...) không phải 401 thì cứ báo lỗi bình thường
    return Promise.reject(error);
  }
);
