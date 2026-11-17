import type {
  BenchmarkQueryCategory,
  GoldenBenchmarkQuery,
  GoldenCorpusChunk,
  GoldenCorpusDocument,
  GoldenDatasetSummary,
} from '../rag-benchmark.types.js';

export const GOLDEN_DATASET_VERSION = 'v1.0.0-2026.11';

export const GOLDEN_CORPUS_DOCUMENTS: readonly GoldenCorpusDocument[] = [
  {
    id: 'doc-os-01',
    subjectName: 'Hệ điều hành',
    fileName: 'Giao_trinh_He_dieu_hanh.pdf',
    pageCount: 168,
  },
  {
    id: 'doc-db-02',
    subjectName: 'Cơ sở dữ liệu',
    fileName: 'He_quan_tri_Co_so_du_lieu.pdf',
    pageCount: 210,
  },
  {
    id: 'doc-net-03',
    subjectName: 'Mạng máy tính',
    fileName: 'Mang_may_tinh_Chuyen_sau.pdf',
    pageCount: 194,
  },
  {
    id: 'doc-se-04',
    subjectName: 'Kỹ thuật phần mềm',
    fileName: 'Kien_truc_va_Thiet_ke_Phan_mem.pdf',
    pageCount: 152,
  },
  {
    id: 'doc-ai-05',
    subjectName: 'Trí tuệ nhân tạo',
    fileName: 'Tri_tue_nhan_tao_va_Hoc_may.pdf',
    pageCount: 240,
  },
];

export const GOLDEN_CORPUS_CHUNKS: readonly GoldenCorpusChunk[] = [
  // ─── 1. Hệ điều hành (os-c1 .. os-c7) ──────────────────────────────────
  {
    id: 'os-c1',
    documentId: 'doc-os-01',
    fileName: 'Giao_trinh_He_dieu_hanh.pdf',
    subjectName: 'Hệ điều hành',
    chunkIndex: 1,
    pageNumbers: [24],
    headings: ['Chương 2: Tiến trình & Lập lịch CPU', '2.3 Thuật toán Round-Robin'],
    chunkType: 'text',
    content:
      'Thuật toán điều phối Round-Robin cấp phát cho mỗi tiến trình trong hàng đợi sẵn sàng một lát cắt thời gian cố định gọi là time quantum q (thường 10–100 ms). Nếu tiến trình chưa hoàn tất sau khi hết q, nó bị thu hồi CPU và đưa về cuối hàng đợi FIFO.',
    semanticConcepts: [
      'lập lịch CPU chia sẻ thời gian công bằng',
      'hàng đợi tiến trình sẵn sàng luân phiên',
      'khoảng thời gian thực thi cố định tránh bỏ đói',
    ],
    exactTerms: ['Round-Robin', 'time quantum', 'FIFO', '10-100 ms'],
  },
  {
    id: 'os-c2',
    documentId: 'doc-os-01',
    fileName: 'Giao_trinh_He_dieu_hanh.pdf',
    subjectName: 'Hệ điều hành',
    chunkIndex: 2,
    pageNumbers: [28, 29],
    headings: ['Chương 2: Tiến trình & Lập lịch CPU', '2.4 Bảng so sánh các thuật toán lập lịch'],
    chunkType: 'table',
    content:
      '| Thuật toán | Tiêu chí chọn | Preemptive | Nguy cơ Starvation |\n| FCFS | Đến trước phục vụ trước | Không | Không |\n| SJF | Burst time ngắn nhất | Tùy chọn | Có |\n| Round-Robin | Luân phiên theo quantum q | Có | Không |',
    semanticConcepts: [
      'so sánh các giải thuật điều phối CPU',
      'nguy cơ tiến trình bị bỏ đói lâu không được chạy',
      'thời gian chờ trung bình tối ưu',
    ],
    exactTerms: ['FCFS', 'SJF', 'Round-Robin', 'Starvation', 'Preemptive', 'Burst time'],
  },
  {
    id: 'os-c3',
    documentId: 'doc-os-01',
    fileName: 'Giao_trinh_He_dieu_hanh.pdf',
    subjectName: 'Hệ điều hành',
    chunkIndex: 3,
    pageNumbers: [45, 46],
    headings: ['Chương 3: Đồng bộ & Deadlock', '3.2 Bốn điều kiện cần của Deadlock'],
    chunkType: 'text',
    content:
      'Deadlock (bế tắc) xảy ra đồng thời khi thỏa mãn cả 4 điều kiện Coffman: (1) Mutual Exclusion (loại trừ tương hỗ), (2) Hold and Wait (giữ và chờ), (3) No Preemption (không trưng dụng), và (4) Circular Wait (chờ vòng tròn).',
    semanticConcepts: [
      'hai hay nhiều tiến trình kẹt cứng chờ tài nguyên của nhau vĩnh viễn',
      'bốn điều kiện bắt buộc dẫn đến tắc nghẽn hệ thống',
      'đồng bộ hóa tài nguyên chia sẻ bị khóa chéo',
    ],
    exactTerms: [
      'Deadlock',
      'Coffman',
      'Mutual Exclusion',
      'Hold and Wait',
      'No Preemption',
      'Circular Wait',
    ],
  },
  {
    id: 'os-c4',
    documentId: 'doc-os-01',
    fileName: 'Giao_trinh_He_dieu_hanh.pdf',
    subjectName: 'Hệ điều hành',
    chunkIndex: 4,
    pageNumbers: [51, 52],
    headings: ['Chương 3: Đồng bộ & Deadlock', '3.4 Thuật toán Banker'],
    chunkType: 'formula',
    content:
      'Thuật toán Banker kiểm tra trạng thái an toàn trước khi cấp phát tài nguyên. Ma trận nhu cầu còn lại được tính bằng công thức: $Need[i][j] = Max[i][j] - Allocation[i][j]$. Hệ thống chỉ cấp phát nếu tồn tại chuỗi an toàn thỏa mãn $Need_i \\le Work$.',
    semanticConcepts: [
      'phòng tránh tắc nghẽn bằng cách kiểm tra trạng thái an toàn trước khi cấp phát',
      'mô phỏng cấp phát tài nguyên trước khi thực thi thật',
    ],
    exactTerms: ['Banker', 'Need[i][j]', 'Max[i][j]', 'Allocation[i][j]', 'Work'],
  },
  {
    id: 'os-c5',
    documentId: 'doc-os-01',
    fileName: 'Giao_trinh_He_dieu_hanh.pdf',
    subjectName: 'Hệ điều hành',
    chunkIndex: 5,
    pageNumbers: [76],
    headings: ['Chương 4: Quản lý Bộ nhớ Ảo', '4.1 Phân trang và TLB'],
    chunkType: 'formula',
    content:
      'Cơ chế Paging chia bộ nhớ vật lý thành frames và logic thành pages. Bộ nhớ đệm TLB (Translation Lookaside Buffer) tăng tốc tra cứu bảng trang với Effective Access Time: $EAT = \\alpha(t_{TLB} + t_{mem}) + (1 - \\alpha)(t_{TLB} + 2t_{mem})$.',
    semanticConcepts: [
      'ánh xạ địa chỉ ảo sang địa chỉ vật lý qua bảng trang',
      'bộ nhớ đệm phần cứng tăng tốc truy xuất bộ nhớ',
      'thời gian truy cập hiệu dụng khi phân trang',
    ],
    exactTerms: ['Paging', 'TLB', 'Translation Lookaside Buffer', 'EAT', 'frames', 'pages'],
  },
  {
    id: 'os-c6',
    documentId: 'doc-os-01',
    fileName: 'Giao_trinh_He_dieu_hanh.pdf',
    subjectName: 'Hệ điều hành',
    chunkIndex: 6,
    pageNumbers: [84],
    headings: ['Chương 4: Quản lý Bộ nhớ Ảo', '4.3 Hiện tượng Thrashing'],
    chunkType: 'text',
    content:
      'Thrashing xảy ra khi số lượng tiến trình đồng thời vượt quá dung lượng RAM khiến tỷ lệ lỗi trang (Page Fault) tăng vọt; CPU liên tục bận hoán đổi trang với ổ đĩa (swapping) thay vì thực thi lệnh.',
    semanticConcepts: [
      'hệ thống bị chậm nghiêm trọng do tráo đổi bộ nhớ liên tục giữa RAM và đĩa cứng',
      'lỗi trang liên hoàn làm sụt giảm hiệu năng CPU',
    ],
    exactTerms: ['Thrashing', 'Page Fault', 'swapping', 'Working Set'],
  },
  {
    id: 'os-c7',
    documentId: 'doc-os-01',
    fileName: 'Giao_trinh_He_dieu_hanh.pdf',
    subjectName: 'Hệ điều hành',
    chunkIndex: 7,
    pageNumbers: [40],
    headings: ['Chương 3: Đồng bộ & Deadlock', '3.1 Semaphore và Mutex'],
    chunkType: 'code',
    content:
      '```c\nvoid wait(Semaphore *S) { S->value--; if (S->value < 0) block(); }\nvoid signal(Semaphore *S) { S->value++; if (S->value <= 0) wakeup(); }\n```\nMutex là khóa nhị phân có quyền sở hữu (ownership), còn Counting Semaphore cho phép tối đa N luồng vào vùng găng (Critical Section).',
    semanticConcepts: [
      'bảo vệ đoạn găng khi nhiều luồng truy cập đồng thời',
      'khác biệt giữa khóa nhị phân và biến đếm đồng bộ',
    ],
    exactTerms: ['Semaphore', 'Mutex', 'wait', 'signal', 'Critical Section', 'ownership'],
  },

  // ─── 2. Cơ sở dữ liệu (db-c1 .. db-c7) ──────────────────────────────────
  {
    id: 'db-c1',
    documentId: 'doc-db-02',
    fileName: 'He_quan_tri_Co_so_du_lieu.pdf',
    subjectName: 'Cơ sở dữ liệu',
    chunkIndex: 1,
    pageNumbers: [14],
    headings: ['Chương 1: Mô hình Quan hệ', '1.2 RDBMS và Khóa ngoại'],
    chunkType: 'text',
    content:
      'Relational Database Management System (RDBMS) tổ chức dữ liệu thành các bảng hai chiều (relations) gồm bộ giá trị (tuples) và thuộc tính, đảm bảo toàn vẹn tham chiếu thông qua Primary Key và Foreign Key.',
    semanticConcepts: [
      'lưu trữ dữ liệu có cấu trúc dạng bảng liên kết chặt chẽ',
      'toàn vẹn tham chiếu giữa các thực thể trong cơ sở dữ liệu',
    ],
    exactTerms: ['RDBMS', 'Relational Database', 'Primary Key', 'Foreign Key', 'tuples'],
  },
  {
    id: 'db-c2',
    documentId: 'doc-db-02',
    fileName: 'He_quan_tri_Co_so_du_lieu.pdf',
    subjectName: 'Cơ sở dữ liệu',
    chunkIndex: 2,
    pageNumbers: [38, 39],
    headings: ['Chương 2: Chuẩn hóa Dữ liệu', '2.3 Dạng chuẩn 3NF và BCNF'],
    chunkType: 'text',
    content:
      'Lược đồ quan hệ đạt dạng chuẩn 3NF (Third Normal Form) nếu đã đạt 2NF và không tồn tại phụ thuộc hàm bắc cầu (transitive dependency) từ thuộc tính không khóa vào khóa chính. Dạng chuẩn BCNF yêu cầu mọi định thức X trong phụ thuộc hàm X -> Y không tầm thường đều phải là siêu khóa (Superkey).',
    semanticConcepts: [
      'loại bỏ dư thừa dữ liệu và bất thường khi cập nhật bảng',
      'loại bỏ phụ thuộc bắc cầu trong thiết kế bảng dữ liệu',
    ],
    exactTerms: ['3NF', 'BCNF', '2NF', 'Superkey', 'transitive dependency'],
  },
  {
    id: 'db-c3',
    documentId: 'doc-db-02',
    fileName: 'He_quan_tri_Co_so_du_lieu.pdf',
    subjectName: 'Cơ sở dữ liệu',
    chunkIndex: 3,
    pageNumbers: [64],
    headings: ['Chương 3: Giao dịch ACID', '3.1 Bốn tính chất ACID'],
    chunkType: 'text',
    content:
      'Giao dịch (Transaction) tuân thủ 4 tính chất ACID: Atomicity (tính nguyên tử - toàn bộ hoặc không gì cả), Consistency (nhất quán ràng buộc), Isolation (cô lập thực thi đồng thời), và Durability (bền vững dữ liệu sau commit nhờ Write-Ahead Logging - WAL).',
    semanticConcepts: [
      'đảm bảo thao tác chuyển tiền không bị mất dữ liệu giữa chừng khi sập nguồn',
      'nhật ký ghi trước bảo vệ dữ liệu đã xác nhận',
    ],
    exactTerms: ['ACID', 'Atomicity', 'Consistency', 'Isolation', 'Durability', 'WAL'],
  },
  {
    id: 'db-c4',
    documentId: 'doc-db-02',
    fileName: 'He_quan_tri_Co_so_du_lieu.pdf',
    subjectName: 'Cơ sở dữ liệu',
    chunkIndex: 4,
    pageNumbers: [71],
    headings: ['Chương 3: Giao dịch ACID', '3.3 Bảng mức độ cô lập SQL'],
    chunkType: 'table',
    content:
      '| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read |\n| Read Uncommitted | Có | Có | Có |\n| Read Committed | Không | Có | Có |\n| Repeatable Read | Không | Không | Có |\n| Serializable | Không | Không | Không |',
    semanticConcepts: [
      'cân bằng giữa tính nhất quán dữ liệu và hiệu năng xử lý đồng thời',
      'hiện tượng đọc bẩn và đọc bóng ma khi chạy nhiều giao dịch song song',
    ],
    exactTerms: [
      'Read Committed',
      'Repeatable Read',
      'Serializable',
      'Dirty Read',
      'Phantom Read',
    ],
  },
  {
    id: 'db-c5',
    documentId: 'doc-db-02',
    fileName: 'He_quan_tri_Co_so_du_lieu.pdf',
    subjectName: 'Cơ sở dữ liệu',
    chunkIndex: 5,
    pageNumbers: [95],
    headings: ['Chương 4: Chỉ mục & Tối ưu Truy vấn', '4.1 B+Tree Index vs Hash Index'],
    chunkType: 'text',
    content:
      'Chỉ mục B+Tree duy trì các khóa được sắp xếp ở nút lá liên kết tuần tự nên hỗ trợ tốt cả truy vấn bằng (=) lẫn truy vấn khoảng (BETWEEN, >, <, ORDER BY) với độ phức tạp O(log n). Hash Index đạt O(1) cho phép so sánh bằng (=) nhưng không hỗ trợ truy vấn khoảng.',
    semanticConcepts: [
      'tăng tốc tìm kiếm bản ghi theo khoảng giá trị hoặc sắp xếp tăng dần',
      'so sánh cấu trúc chỉ mục cây cân bằng và bảng băm trong SQL',
    ],
    exactTerms: ['B+Tree', 'Hash Index', 'BETWEEN', 'O(log n)', 'O(1)'],
  },
  {
    id: 'db-c6',
    documentId: 'doc-db-02',
    fileName: 'He_quan_tri_Co_so_du_lieu.pdf',
    subjectName: 'Cơ sở dữ liệu',
    chunkIndex: 6,
    pageNumbers: [118],
    headings: ['Chương 5: Tìm kiếm Toàn văn & Vector', '5.2 PGroonga và Reciprocal Rank Fusion'],
    chunkType: 'formula',
    content:
      'Để kết hợp tìm kiếm ngữ nghĩa pgvector và toàn văn PGroonga (&@~) nằm trên hai thang đo khác nhau, thuật toán RRF (Reciprocal Rank Fusion) hợp nhất theo thứ hạng: $\\text{RRF}(d) = \\frac{1}{k + \\text{rank}_{vec}(d)} + \\frac{1}{k + \\text{rank}_{kw}(d)}$ với hằng số làm mượt $k = 60$.',
    semanticConcepts: [
      'hợp nhất kết quả tìm kiếm từ khóa và tìm kiếm ngữ nghĩa không cần chuẩn hóa điểm',
      'giảm ảnh hưởng của giá trị ngoại lai khi trộn thứ hạng',
    ],
    exactTerms: ['PGroonga', 'pgvector', 'RRF', 'k = 60', '&@~', 'Reciprocal Rank Fusion'],
  },
  {
    id: 'db-c7',
    documentId: 'doc-db-02',
    fileName: 'He_quan_tri_Co_so_du_lieu.pdf',
    subjectName: 'Cơ sở dữ liệu',
    chunkIndex: 7,
    pageNumbers: [132],
    headings: ['Chương 5: Tìm kiếm Toàn văn & Vector', '5.4 Chỉ mục Vector HNSW'],
    chunkType: 'text',
    content:
      'HNSW (Hierarchical Navigable Small World) xây dựng đồ thị nhiều tầng giúp truy vấn Approximate Nearest Neighbor (ANN) nhanh gấp nhiều lần quét tuần tự chính xác, kiểm soát đánh đổi giữa tốc độ và Recall qua tham số m và ef_construction.',
    semanticConcepts: [
      'tìm kiếm vector tương đồng tốc độ cao trên hàng triệu đoạn văn bản',
      'đồ thị phân tầng cho truy xuất láng giềng gần nhất xấp xỉ',
    ],
    exactTerms: ['HNSW', 'ANN', 'ef_construction', 'Cosine'],
  },

  // ─── 3. Mạng máy tính (net-c1 .. net-c7) ─────────────────────────────────
  {
    id: 'net-c1',
    documentId: 'doc-net-03',
    fileName: 'Mang_may_tinh_Chuyen_sau.pdf',
    subjectName: 'Mạng máy tính',
    chunkIndex: 1,
    pageNumbers: [32],
    headings: ['Chương 2: Tầng Giao vận (Transport)', '2.1 Bắt tay 3 bước TCP'],
    chunkType: 'text',
    content:
      'Thiết lập kết nối TCP sử dụng quy trình bắt tay 3 bước (3-way Handshake): Client gửi gói SYN(seq=x), Server phản hồi SYN-ACK(seq=y, ack=x+1), và Client gửi lại ACK(ack=y+1) để đồng bộ số thứ tự trước khi truyền dữ liệu tin cậy.',
    semanticConcepts: [
      'khởi tạo phiên truyền thông tin cậy hướng kết nối giữa máy khách và máy chủ',
      'đồng bộ số thứ tự gói tin trước khi truyền dữ liệu',
    ],
    exactTerms: ['TCP', '3-way Handshake', 'SYN', 'SYN-ACK', 'ACK'],
  },
  {
    id: 'net-c2',
    documentId: 'doc-net-03',
    fileName: 'Mang_may_tinh_Chuyen_sau.pdf',
    subjectName: 'Mạng máy tính',
    chunkIndex: 2,
    pageNumbers: [39],
    headings: ['Chương 2: Tầng Giao vận (Transport)', '2.3 So sánh TCP và UDP'],
    chunkType: 'table',
    content:
      '| Đặc điểm | TCP | UDP |\n| Kết nối | Connection-oriented | Connectionless |\n| Độ tin cậy | Đảm bảo thứ tự, truyền lại gói mất | Best-effort, không truyền lại |\n| Header | 20 bytes | 8 bytes |\n| Ứng dụng | HTTP/HTTPS, SSH, SMTP | DNS, Video Streaming, VoIP |',
    semanticConcepts: [
      'lựa chọn giao thức truyền tải cho gọi video thời gian thực so với tải tệp tin',
      'khác biệt về độ trễ và kiểm soát mất gói giữa hai giao thức tầng vận chuyển',
    ],
    exactTerms: ['TCP', 'UDP', 'Connectionless', '20 bytes', '8 bytes', 'VoIP'],
  },
  {
    id: 'net-c3',
    documentId: 'doc-net-03',
    fileName: 'Mang_may_tinh_Chuyen_sau.pdf',
    subjectName: 'Mạng máy tính',
    chunkIndex: 3,
    pageNumbers: [48],
    headings: ['Chương 2: Tầng Giao vận (Transport)', '2.5 Kiểm soát tắc nghẽn AIMD'],
    chunkType: 'text',
    content:
      'Kiểm soát tắc nghẽn TCP sử dụng cửa sổ tắc nghẽn cwnd qua các pha Slow Start (tăng hàm mũ gấp đôi mỗi RTT đến ssthresh) và Congestion Avoidance (tăng tuyến tính AIMD - Additive Increase Multiplicative Decrease khi phát hiện mất gói qua 3-Duplicate ACK hoặc Timeout).',
    semanticConcepts: [
      'điều chỉnh tốc độ gửi dữ liệu để tránh làm nghẽn bộ định tuyến mạng',
      'giảm một nửa băng thông khi có dấu hiệu nghẽn mạch',
    ],
    exactTerms: ['cwnd', 'Slow Start', 'AIMD', 'ssthresh', '3-Duplicate ACK', 'RTT'],
  },
  {
    id: 'net-c4',
    documentId: 'doc-net-03',
    fileName: 'Mang_may_tinh_Chuyen_sau.pdf',
    subjectName: 'Mạng máy tính',
    chunkIndex: 4,
    pageNumbers: [72],
    headings: ['Chương 3: Tầng Ứng dụng', '3.2 HTTP/3 và Giao thức QUIC'],
    chunkType: 'text',
    content:
      'HTTP/3 chạy trên nền giao thức QUIC (xây dựng trên UDP) giải quyết triệt để lỗi Head-of-Line Blocking ở tầng giao vận của TCP bằng cách hỗ trợ ghép kênh các luồng (multiplexed streams) độc lập và tích hợp sẵn TLS 1.3 giúp giảm xuống 0-RTT hoặc 1-RTT handshake.',
    semanticConcepts: [
      'tăng tốc tải trang web khi một gói tin bị rơi mà không chặn các luồng khác',
      'giao thức web thế hệ mới loại bỏ nghẽn đầu hàng',
    ],
    exactTerms: ['HTTP/3', 'QUIC', 'UDP', 'Head-of-Line Blocking', 'TLS 1.3', '0-RTT'],
  },
  {
    id: 'net-c5',
    documentId: 'doc-net-03',
    fileName: 'Mang_may_tinh_Chuyen_sau.pdf',
    subjectName: 'Mạng máy tính',
    chunkIndex: 5,
    pageNumbers: [104],
    headings: ['Chương 4: Tầng Mạng (Network)', '4.2 Định tuyến OSPF và Dijkstra'],
    chunkType: 'text',
    content:
      'OSPF (Open Shortest Path First) là giao thức định tuyến nội miền (IGP) theo trạng thái liên kết (Link-State). Mỗi router phát tán gói LSA để xây dựng bản đồ topo đầy đủ và chạy thuật toán Dijkstra tính cây đường đi ngắn nhất theo chi phí liên kết.',
    semanticConcepts: [
      'tìm đường đi tối ưu giữa các bộ định tuyến trong cùng một hệ thống mạng tổ chức',
      'phát tán trạng thái đường truyền để mọi nút có cùng bản đồ mạng',
    ],
    exactTerms: ['OSPF', 'Dijkstra', 'Link-State', 'LSA', 'IGP'],
  },
  {
    id: 'net-c6',
    documentId: 'doc-net-03',
    fileName: 'Mang_may_tinh_Chuyen_sau.pdf',
    subjectName: 'Mạng máy tính',
    chunkIndex: 6,
    pageNumbers: [119],
    headings: ['Chương 4: Tầng Mạng (Network)', '4.5 Chia mạng con CIDR'],
    chunkType: 'formula',
    content:
      'Kỹ thuật định tuyến liên miền không phân lớp CIDR (Classless Inter-Domain Routing) biểu diễn tiền tố mạng dạng `a.b.c.d/x`. Số lượng địa chỉ IP khả dụng cho host trong mạng con `/x` là $2^{32 - x} - 2$ (trừ địa chỉ mạng và địa chỉ broadcast).',
    semanticConcepts: [
      'tính số máy trạm tối đa có thể gán trong một dải địa chỉ IPv4',
      'phân chia mặt nạ mạng linh hoạt tránh lãng phí địa chỉ IP',
    ],
    exactTerms: ['CIDR', 'IPv4', 'broadcast', '2^(32 - x) - 2'],
  },
  {
    id: 'net-c7',
    documentId: 'doc-net-03',
    fileName: 'Mang_may_tinh_Chuyen_sau.pdf',
    subjectName: 'Mạng máy tính',
    chunkIndex: 7,
    pageNumbers: [142],
    headings: ['Chương 5: An ninh Mạng', '5.1 Hệ thống Phân giải Tên miền DNS'],
    chunkType: 'text',
    content:
      'DNS (Domain Name System) ánh xạ tên miền dễ đọc thành địa chỉ IP theo cấu trúc phân cấp gồm Root Server, TLD (.com, .vn) và Authoritative Name Server, sử dụng bản ghi A/AAAA (IPv4/IPv6), CNAME và MX cùng cơ chế lưu đệm TTL.',
    semanticConcepts: [
      'dịch tên trang web sang địa chỉ số để trình duyệt kết nối',
      'hệ thống danh bạ phân tán của Internet',
    ],
    exactTerms: ['DNS', 'TLD', 'Authoritative', 'CNAME', 'MX', 'TTL'],
  },

  // ─── 4. Kỹ thuật phần mềm (se-c1 .. se-c7) ──────────────────────────────
  {
    id: 'se-c1',
    documentId: 'doc-se-04',
    fileName: 'Kien_truc_va_Thiet_ke_Phan_mem.pdf',
    subjectName: 'Kỹ thuật phần mềm',
    chunkIndex: 1,
    pageNumbers: [18],
    headings: ['Chương 1: Kiến trúc Phần mềm', '1.3 Clean Architecture & Hexagonal'],
    chunkType: 'text',
    content:
      'Kiến trúc Lục giác (Hexagonal / Ports & Adapters) và Clean Architecture áp đặt Dependency Rule: mọi phụ thuộc mã nguồn chỉ hướng vào trong. Tầng Domain thuần khiết không phụ thuộc Framework hay ORM; Application định nghĩa Ports (interface) và Infrastructure cài đặt Adapters.',
    semanticConcepts: [
      'tách biệt logic nghiệp vụ cốt lõi khỏi cơ sở dữ liệu và web framework',
      'dễ dàng thay thế nhà cung cấp bên ngoài mà không sửa quy tắc nghiệp vụ',
    ],
    exactTerms: ['Hexagonal', 'Clean Architecture', 'Dependency Rule', 'Ports', 'Adapters', 'Domain'],
  },
  {
    id: 'se-c2',
    documentId: 'doc-se-04',
    fileName: 'Kien_truc_va_Thiet_ke_Phan_mem.pdf',
    subjectName: 'Kỹ thuật phần mềm',
    chunkIndex: 2,
    pageNumbers: [34],
    headings: ['Chương 2: Nguyên lý Thiết kế SOLID', '2.2 SRP, OCP và DIP'],
    chunkType: 'text',
    content:
      'Trong bộ nguyên lý SOLID: SRP (Single Responsibility Principle) yêu cầu mỗi module chỉ có một lý do để thay đổi; OCP (Open/Closed) mở cho mở rộng nhưng đóng cho sửa đổi; DIP (Dependency Inversion) yêu cầu module cấp cao phụ thuộc vào abstraction chứ không phụ thuộc chi tiết cài đặt.',
    semanticConcepts: [
      'viết mã nguồn dễ bảo trì và mở rộng tính năng mà không phá vỡ code cũ',
      'đảo ngược sự phụ thuộc qua giao diện trừu tượng',
    ],
    exactTerms: ['SOLID', 'SRP', 'OCP', 'DIP', 'Dependency Inversion'],
  },
  {
    id: 'se-c3',
    documentId: 'doc-se-04',
    fileName: 'Kien_truc_va_Thiet_ke_Phan_mem.pdf',
    subjectName: 'Kỹ thuật phần mềm',
    chunkIndex: 3,
    pageNumbers: [58],
    headings: ['Chương 3: Độ tin cậy Hệ thống', '3.1 Circuit Breaker & Timeout'],
    chunkType: 'text',
    content:
      'Mẫu Circuit Breaker (Cầu dao ngắt mạch) có 3 trạng thái: Closed (cho gọi bình thường), Open (ngắt tức thì trả về fallback khi tỷ lệ lỗi vượt ngưỡng để tránh hiệu ứng dây chuyền Cascading Failure), và Half-Open (cho thử một số ít request để kiểm tra phục hồi).',
    semanticConcepts: [
      'cô lập lỗi khi dịch vụ bên thứ ba bị treo hoặc quá tải',
      'ngăn chặn lỗi lan truyền làm sập toàn bộ hệ thống',
    ],
    exactTerms: ['Circuit Breaker', 'Closed', 'Open', 'Half-Open', 'Cascading Failure', 'Fallback'],
  },
  {
    id: 'se-c4',
    documentId: 'doc-se-04',
    fileName: 'Kien_truc_va_Thiet_ke_Phan_mem.pdf',
    subjectName: 'Kỹ thuật phần mềm',
    chunkIndex: 4,
    pageNumbers: [74],
    headings: ['Chương 3: Độ tin cậy Hệ thống', '3.3 Hàng đợi Bất đồng bộ BullMQ'],
    chunkType: 'text',
    content:
      'Đối với tác vụ nặng như OCR tài liệu hoặc xử lý video, hệ thống không xử lý đồng bộ trong HTTP Request mà đẩy job vào Message Queue (Redis/BullMQ) với chiến lược Exponential Backoff retry và khóa lockDuration nhằm giải phóng luồng API và chống HTTP Timeout.',
    semanticConcepts: [
      'xử lý nền tác vụ tốn nhiều thời gian để giao diện phản hồi ngay lập tức',
      'thử lại tự động theo cấp số nhân khi tiến trình nền gặp lỗi tạm thời',
    ],
    exactTerms: ['BullMQ', 'Redis', 'Exponential Backoff', 'lockDuration', 'HTTP Timeout'],
  },
  {
    id: 'se-c5',
    documentId: 'doc-se-04',
    fileName: 'Kien_truc_va_Thiet_ke_Phan_mem.pdf',
    subjectName: 'Kỹ thuật phần mềm',
    chunkIndex: 5,
    pageNumbers: [96],
    headings: ['Chương 4: Kiểm thử Phần mềm', '4.1 Tháp Kiểm thử (Testing Pyramid)'],
    chunkType: 'table',
    content:
      '| Tầng kiểm thử | Tốc độ | Độ cô lập | Chi phí bảo trì |\n| Unit Test | Rất nhanh (ms) | Cao (Fake/Mock Ports) | Thấp |\n| Integration Test | Trung bình | Kiểm tra kết nối DB/Queue | Trung bình |\n| E2E Test | Chậm | Toàn bộ hệ thống qua UI | Cao |',
    semanticConcepts: [
      'phân bổ tỷ lệ kiểm thử đơn vị và kiểm thử đầu cuối hợp lý',
      'dùng giả lập phụ thuộc để chạy kiểm thử nhanh không cần mạng',
    ],
    exactTerms: ['Testing Pyramid', 'Unit Test', 'Integration Test', 'E2E Test', 'Mock'],
  },
  {
    id: 'se-c6',
    documentId: 'doc-se-04',
    fileName: 'Kien_truc_va_Thiet_ke_Phan_mem.pdf',
    subjectName: 'Kỹ thuật phần mềm',
    chunkIndex: 6,
    pageNumbers: [112],
    headings: ['Chương 5: Thiết kế Frontend', '5.1 Feature-Sliced Design (FSD)'],
    chunkType: 'text',
    content:
      'Feature-Sliced Design (FSD v2.1) phân tầng kiến trúc Frontend theo thứ tự nhập khẩu một chiều từ trên xuống dưới: app -> pages -> widgets -> features -> entities -> shared. Các slice cùng tầng không được import chéo trực tiếp mà giao tiếp qua Public API (index.ts).',
    semanticConcepts: [
      'tổ chức thư mục giao diện người dùng quy mô lớn tránh phụ thuộc vòng tròn',
      'phân lớp mã nguồn React theo chức năng nghiệp vụ',
    ],
    exactTerms: ['FSD', 'Feature-Sliced Design', 'Public API', 'widgets', 'entities', 'shared'],
  },
  {
    id: 'se-c7',
    documentId: 'doc-se-04',
    fileName: 'Kien_truc_va_Thiet_ke_Phan_mem.pdf',
    subjectName: 'Kỹ thuật phần mềm',
    chunkIndex: 7,
    pageNumbers: [128],
    headings: ['Chương 5: Thiết kế Frontend', '5.3 Luồng DTO Mapping 4 tầng'],
    chunkType: 'code',
    content:
      '```ts\nexport function mapUserProfile(raw: RawUserDto): UserProfile {\n  return { id: raw.id, createdAt: new Date(raw.created_at).toISOString() };\n}\n```\nMọi phản hồi JSON dạng snake_case từ Backend phải qua tầng Service Layer ánh xạ sang camelCase trước khi vào UI Component.',
    semanticConcepts: [
      'chuyển đổi định dạng dữ liệu từ máy chủ sang chuẩn giao diện',
      'tách biệt lệnh gọi HTTP khỏi thành phần hiển thị React',
    ],
    exactTerms: ['DTO Mapping', 'snake_case', 'camelCase', 'Service Layer', 'axiosClient'],
  },

  // ─── 5. Trí tuệ nhân tạo & Học máy (ai-c1 .. ai-c7) ─────────────────────
  {
    id: 'ai-c1',
    documentId: 'doc-ai-05',
    fileName: 'Tri_tue_nhan_tao_va_Hoc_may.pdf',
    subjectName: 'Trí tuệ nhân tạo',
    chunkIndex: 1,
    pageNumbers: [44],
    headings: ['Chương 2: Kiến trúc Transformer', '2.2 Scaled Dot-Product Attention'],
    chunkType: 'formula',
    content:
      'Cơ chế Tự chú ý (Self-Attention) trong Transformer tính trọng số liên kết giữa các token theo công thức: $\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V$. Hệ số chia $\\sqrt{d_k}$ ngăn tích vô hướng quá lớn làm bão hòa hàm softmax.',
    semanticConcepts: [
      'mô hình ngôn ngữ lớn xác định mức độ liên quan giữa các từ trong câu',
      'tránh triệt tiêu đạo hàm khi kích thước vector khóa quá lớn',
    ],
    exactTerms: ['Self-Attention', 'Transformer', 'Q, K, V', 'softmax', 'sqrt(d_k)'],
  },
  {
    id: 'ai-c2',
    documentId: 'doc-ai-05',
    fileName: 'Tri_tue_nhan_tao_va_Hoc_may.pdf',
    subjectName: 'Trí tuệ nhân tạo',
    chunkIndex: 2,
    pageNumbers: [88],
    headings: ['Chương 3: Retrieval-Augmented Generation', '3.1 Bi-Encoder vs Cross-Encoder'],
    chunkType: 'text',
    content:
      'Bi-Encoder (Embedding) mã hóa độc lập câu hỏi và tài liệu thành 2 vector để tìm kiếm nhanh trên hàng triệu đoạn (Recall cao). Ngược lại, Cross-Encoder (như bge-reranker-v2-m3) ghép cặp [Query, Document] cho phép cơ chế cross-attention tương tác từng token (Precision vượt trội ở bước Reranking Top-M).',
    semanticConcepts: [
      'truy xuất hai giai đoạn kết hợp lọc thô nhanh và tái xếp hạng độ chính xác cao',
      'tương tác chéo từng cặp từ giữa câu hỏi và đoạn văn ứng viên',
    ],
    exactTerms: [
      'Bi-Encoder',
      'Cross-Encoder',
      'bge-reranker-v2-m3',
      'Reranking',
      'cross-attention',
    ],
  },
  {
    id: 'ai-c3',
    documentId: 'doc-ai-05',
    fileName: 'Tri_tue_nhan_tao_va_Hoc_may.pdf',
    subjectName: 'Trí tuệ nhân tạo',
    chunkIndex: 3,
    pageNumbers: [102],
    headings: ['Chương 3: Retrieval-Augmented Generation', '3.3 Query Decomposition'],
    chunkType: 'text',
    content:
      'Kỹ thuật Query Decomposition phân rã câu hỏi phức hợp đa ý (ví dụ câu so sánh hai khái niệm ở hai chương khác nhau) thành 2–3 sub-queries độc lập kết hợp mở rộng từ khóa đồng nghĩa Việt–Anh để tránh hiện tượng loãng ngữ nghĩa trên 1 vector đơn lẻ.',
    semanticConcepts: [
      'chia nhỏ câu hỏi phức tạp thành nhiều câu truy vấn con độc lập',
      'giải quyết tình trạng vector đơn bị loãng nghĩa khi hỏi nhiều chủ đề',
    ],
    exactTerms: ['Query Decomposition', 'sub-queries', 'loãng ngữ nghĩa'],
  },
  {
    id: 'ai-c4',
    documentId: 'doc-ai-05',
    fileName: 'Tri_tue_nhan_tao_va_Hoc_may.pdf',
    subjectName: 'Trí tuệ nhân tạo',
    chunkIndex: 4,
    pageNumbers: [130],
    headings: ['Chương 4: Đánh giá Hệ thống AI', '4.1 Thước đo Truy xuất Hit Rate, MRR, NDCG'],
    chunkType: 'formula',
    content:
      'Đánh giá chất lượng truy xuất thông tin sử dụng: Hit Rate@K (tỷ lệ có ít nhất 1 kết quả đúng trong Top-K), MRR (trung bình nghịch đảo hạng đầu tiên $\\frac{1}{rank}$), và NDCG@K $= \\frac{\\text{DCG}@K}{\\text{IDCG}@K}$ phản ánh cả mức độ liên quan phân cấp lẫn vị trí xếp hạng.',
    semanticConcepts: [
      'đo lường định lượng hiệu quả xếp hạng đoạn văn của công cụ tìm kiếm',
      'chỉ số ưu tiên tài liệu đúng nằm càng gần đầu danh sách càng tốt',
    ],
    exactTerms: ['Hit Rate@K', 'MRR', 'NDCG@K', 'DCG', 'IDCG'],
  },
  {
    id: 'ai-c5',
    documentId: 'doc-ai-05',
    fileName: 'Tri_tue_nhan_tao_va_Hoc_may.pdf',
    subjectName: 'Trí tuệ nhân tạo',
    chunkIndex: 5,
    pageNumbers: [158],
    headings: ['Chương 5: Công nghệ Giáo dục & Học tập Thích ứng', '5.1 Thuật toán Lặp lại Ngắt quãng SM-2'],
    chunkType: 'formula',
    content:
      'Thuật toán SM-2 biến thể Anki quản lý thẻ nhớ qua 4 trạng thái (new, learning, review, relearning) và cập nhật hệ số dễ EF: $EF\' = \\max(1.3, EF + (0.1 - (5 - q)(0.08 + (5 - q) \\times 0.02)))$, giúp tối ưu lịch ôn ngay trước ngưỡng quên của đường cong Ebbinghaus.',
    semanticConcepts: [
      'tính khoảng thời gian nhắc lại thẻ ghi nhớ dài hạn chống quên kiến thức',
      'công thức điều chỉnh độ khó của thẻ flashcard sau mỗi lần ôn tập',
    ],
    exactTerms: ['SM-2', 'Anki', 'ease_factor', 'EF', 'Ebbinghaus', 'relearning'],
  },
  {
    id: 'ai-c6',
    documentId: 'doc-ai-05',
    fileName: 'Tri_tue_nhan_tao_va_Hoc_may.pdf',
    subjectName: 'Trí tuệ nhân tạo',
    chunkIndex: 6,
    pageNumbers: [176],
    headings: ['Chương 5: Công nghệ Giáo dục & Học tập Thích ứng', '5.3 Thang Nhận thức Bloom'],
    chunkType: 'table',
    content:
      '| Cấp độ Bloom | Động từ đặc trưng | Dạng câu hỏi phù hợp |\n| Nhớ (Remember) | Định nghĩa, Liệt kê | True/False, Short Answer |\n| Hiểu (Understand) | Giải thích, Phân biệt | Single Choice |\n| Vận dụng (Apply) | Tính toán, Áp dụng | Multiple Choice, Bài tập |\n| Phân tích (Analyze) | So sánh, Đánh giá | Essay kèm Rubric |',
    semanticConcepts: [
      'phân loại độ khó sư phạm của câu hỏi kiểm tra từ ghi nhớ đến phân tích sâu',
      'thiết kế ma trận đề thi theo mục tiêu năng lực người học',
    ],
    exactTerms: ['Bloom', 'Remember', 'Understand', 'Apply', 'Analyze', 'Rubric'],
  },
  {
    id: 'ai-c7',
    documentId: 'doc-ai-05',
    fileName: 'Tri_tue_nhan_tao_va_Hoc_may.pdf',
    subjectName: 'Trí tuệ nhân tạo',
    chunkIndex: 7,
    pageNumbers: [115],
    headings: ['Chương 3: Retrieval-Augmented Generation', '3.5 Kiểm soát Ảo giác (Anti-Hallucination)'],
    chunkType: 'text',
    content:
      'Để chống ảo giác (Hallucination) trong RAG giáo dục: (1) ép Agent gọi tool truy xuất trước khi trả lời, (2) cấp mã trích dẫn [c1] phía Server gắn tọa độ bbox chống LLM tự bịa số trang, (3) thiết lập ngưỡng độ tin cậy tối thiểu để từ chối trả lời khi truy vấn nằm ngoài tài liệu.',
    semanticConcepts: [
      'ngăn chặn trí tuệ nhân tạo bịa đặt thông tin sai sự thật khi không có trong giáo trình',
      'kiểm chứng câu trả lời bằng tọa độ trích dẫn gốc',
    ],
    exactTerms: ['Anti-Hallucination', 'Hallucination', 'bbox', '[c1]', 'Tool-Grounding'],
  },
];

export const GOLDEN_BENCHMARK_QUERIES: readonly GoldenBenchmarkQuery[] = [
  // ─── Nhóm A: Semantic Lookup (10 câu — diễn đạt đồng nghĩa, ít trùng từ khóa nguyên văn) ──
  {
    id: 'q-sem-01',
    category: 'semantic_lookup',
    subjectName: 'Hệ điều hành',
    question:
      'Làm thế nào để ngăn tình trạng nhiều luồng xử lý kẹt cứng vì đợi nhau nhả tài nguyên mãi mãi?',
    semanticQuery:
      'hai hay nhiều tiến trình kẹt cứng chờ tài nguyên của nhau vĩnh viễn và cách phòng tránh',
    keywords: ['kẹt cứng', 'đợi nhau', 'mãi mãi'],
    decomposedSubQueries: [
      {
        semanticQuery:
          'hai hay nhiều tiến trình kẹt cứng chờ tài nguyên của nhau vĩnh viễn và điều kiện xảy ra',
        keywords: ['Deadlock', 'Coffman', 'Banker'],
      },
    ],
    expectedChunkIds: ['os-c3', 'os-c4'],
    relevanceGrades: { 'os-c3': 3, 'os-c4': 2 },
    notes: 'Diễn đạt dân dã về Deadlock & thuật toán phòng tránh Banker không nhắc thẳng từ Deadlock.',
  },
  {
    id: 'q-sem-02',
    category: 'semantic_lookup',
    subjectName: 'Hệ điều hành',
    question:
      'Tại sao máy tính chạy cực chậm khi mở quá nhiều ứng dụng vượt quá bộ nhớ chính và đĩa cứng quay liên tục?',
    semanticQuery:
      'hệ thống bị chậm nghiêm trọng do tráo đổi bộ nhớ liên tục giữa RAM và đĩa cứng',
    keywords: ['chạy cực chậm', 'đĩa cứng', 'ứng dụng'],
    decomposedSubQueries: [
      {
        semanticQuery:
          'hiện tượng tráo đổi trang bộ nhớ liên hoàn giữa RAM và đĩa cứng làm sụt hiệu năng CPU',
        keywords: ['Thrashing', 'Page Fault', 'swapping'],
      },
    ],
    expectedChunkIds: ['os-c6'],
    relevanceGrades: { 'os-c6': 3 },
    notes: 'Mô tả hiện tượng Thrashing bằng ngôn ngữ thông thường.',
  },
  {
    id: 'q-sem-03',
    category: 'semantic_lookup',
    subjectName: 'Cơ sở dữ liệu',
    question:
      'Cơ chế nào giúp thao tác chuyển khoản ngân hàng không bị trừ tiền một bên mà bên kia chưa nhận khi mất điện?',
    semanticQuery:
      'đảm bảo thao tác chuyển tiền không bị mất dữ liệu giữa chừng khi sập nguồn',
    keywords: ['chuyển khoản', 'ngân hàng', 'mất điện'],
    decomposedSubQueries: [
      {
        semanticQuery: 'tính nguyên tử và bền vững của giao dịch cơ sở dữ liệu khi gặp sự cố',
        keywords: ['ACID', 'Atomicity', 'Durability', 'WAL'],
      },
    ],
    expectedChunkIds: ['db-c3'],
    relevanceGrades: { 'db-c3': 3 },
    notes: 'Câu hỏi ngữ nghĩa về tính chất ACID và Write-Ahead Logging.',
  },
  {
    id: 'q-sem-04',
    category: 'semantic_lookup',
    subjectName: 'Cơ sở dữ liệu',
    question:
      'Làm sao tách bảng để dữ liệu không bị lặp lại dây chuyền khi chỉnh sửa một cột không phải khóa?',
    semanticQuery:
      'loại bỏ dư thừa dữ liệu và phụ thuộc bắc cầu trong thiết kế bảng dữ liệu',
    keywords: ['tách bảng', 'lặp lại dây chuyền', 'chỉnh sửa'],
    decomposedSubQueries: [
      {
        semanticQuery: 'loại bỏ phụ thuộc hàm bắc cầu trong chuẩn hóa lược đồ quan hệ',
        keywords: ['3NF', 'BCNF', 'transitive dependency'],
      },
    ],
    expectedChunkIds: ['db-c2'],
    relevanceGrades: { 'db-c2': 3 },
    notes: 'Kiểm tra hiểu biết ngữ nghĩa về chuẩn 3NF/BCNF.',
  },
  {
    id: 'q-sem-05',
    category: 'semantic_lookup',
    subjectName: 'Mạng máy tính',
    question:
      'Nếu đang gọi video trực tuyến và muốn hình ảnh trôi chảy, chấp nhận bỏ qua vài khung hình lỗi thay vì khựng lại, nên chọn giao thức nào?',
    semanticQuery:
      'lựa chọn giao thức truyền tải cho gọi video thời gian thực độ trễ thấp không truyền lại gói mất',
    keywords: ['hình ảnh trôi chảy', 'khung hình', 'khựng lại'],
    decomposedSubQueries: [
      {
        semanticQuery: 'so sánh giao thức UDP và TCP cho ứng dụng truyền phát video thời gian thực',
        keywords: ['UDP', 'TCP', 'VoIP', 'Video Streaming'],
      },
    ],
    expectedChunkIds: ['net-c2'],
    relevanceGrades: { 'net-c2': 3 },
    notes: 'Truy vấn tình huống thực tế ánh xạ về bảng so sánh TCP vs UDP.',
  },
  {
    id: 'q-sem-06',
    category: 'semantic_lookup',
    subjectName: 'Mạng máy tính',
    question:
      'Vì sao chuẩn web đời mới giải quyết được tình trạng một gói bị thất lạc làm đứng toàn bộ các đường tải song song?',
    semanticQuery:
      'giao thức web thế hệ mới loại bỏ nghẽn đầu hàng khi một gói tin bị rơi',
    keywords: ['thất lạc', 'đường tải', 'chuẩn web'],
    decomposedSubQueries: [
      {
        semanticQuery: 'HTTP/3 và QUIC khắc phục lỗi Head-of-Line Blocking bằng ghép kênh độc lập',
        keywords: ['HTTP/3', 'QUIC', 'Head-of-Line Blocking'],
      },
    ],
    expectedChunkIds: ['net-c4'],
    relevanceGrades: { 'net-c4': 3 },
    notes: 'Diễn đạt tiếng Việt "đứng toàn bộ luồng" ứng với Head-of-Line Blocking trong HTTP/3 QUIC.',
  },
  {
    id: 'q-sem-07',
    category: 'semantic_lookup',
    subjectName: 'Kỹ thuật phần mềm',
    question:
      'Cách tổ chức mã nguồn sao cho sau này chuyển từ PostgreSQL sang MongoDB mà không cần viết lại phần quy tắc nghiệp vụ?',
    semanticQuery:
      'tách biệt logic nghiệp vụ cốt lõi khỏi cơ sở dữ liệu và web framework dễ thay thế',
    keywords: ['PostgreSQL', 'MongoDB', 'viết lại'],
    decomposedSubQueries: [
      {
        semanticQuery:
          'kiến trúc Hexagonal Ports and Adapters và nguyên lý đảo ngược phụ thuộc cô lập tầng Domain',
        keywords: ['Hexagonal', 'Clean Architecture', 'Ports', 'Adapters', 'DIP'],
      },
    ],
    expectedChunkIds: ['se-c1', 'se-c2'],
    relevanceGrades: { 'se-c1': 3, 'se-c2': 2 },
    notes: 'Kết hợp kiến trúc Hexagonal/Clean Architecture và DIP.',
  },
  {
    id: 'q-sem-08',
    category: 'semantic_lookup',
    subjectName: 'Kỹ thuật phần mềm',
    question:
      'Khi dịch vụ AI bên ngoài phản hồi chậm hoặc lỗi liên tục, mẫu thiết kế nào tự động ngắt kết nối để không kéo sập ứng dụng chính?',
    semanticQuery:
      'cô lập lỗi khi dịch vụ bên thứ ba bị treo ngăn chặn lỗi lan truyền làm sập hệ thống',
    keywords: ['bên ngoài', 'tự động ngắt', 'kéo sập'],
    decomposedSubQueries: [
      {
        semanticQuery: 'mẫu Circuit Breaker ngăn ngừa Cascading Failure bằng fallback',
        keywords: ['Circuit Breaker', 'Cascading Failure', 'Fallback'],
      },
    ],
    expectedChunkIds: ['se-c3'],
    relevanceGrades: { 'se-c3': 3 },
    notes: 'Câu hỏi ngữ nghĩa về Circuit Breaker.',
  },
  {
    id: 'q-sem-09',
    category: 'semantic_lookup',
    subjectName: 'Trí tuệ nhân tạo',
    question:
      'Làm sao ứng dụng học tập tính toán chính xác ngày nào cần nhắc sinh viên ôn lại kiến thức ngay trước lúc họ sắp quên?',
    semanticQuery:
      'tính khoảng thời gian nhắc lại thẻ ghi nhớ dài hạn chống quên kiến thức theo đường cong quên lãng',
    keywords: ['ôn lại', 'sắp quên', 'ngày nào'],
    decomposedSubQueries: [
      {
        semanticQuery: 'thuật toán lặp lại ngắt quãng SM-2 biến thể Anki và đường cong Ebbinghaus',
        keywords: ['SM-2', 'Anki', 'Ebbinghaus', 'ease_factor'],
      },
    ],
    expectedChunkIds: ['ai-c5'],
    relevanceGrades: { 'ai-c5': 3 },
    notes: 'Câu hỏi ngữ nghĩa về Spaced Repetition SM-2.',
  },
  {
    id: 'q-sem-10',
    category: 'semantic_lookup',
    subjectName: 'Trí tuệ nhân tạo',
    question:
      'Hệ thống hỏi đáp học thuật cần cơ chế kỹ thuật nào để ngăn AI tự chế ra kiến thức sai lệch không có trong giáo trình?',
    semanticQuery:
      'ngăn chặn trí tuệ nhân tạo bịa đặt thông tin sai sự thật và kiểm chứng bằng trích dẫn gốc',
    keywords: ['tự chế', 'sai lệch', 'hỏi đáp'],
    decomposedSubQueries: [
      {
        semanticQuery: 'các lớp kỹ thuật chống ảo giác Anti-Hallucination và mã trích dẫn gắn bbox',
        keywords: ['Anti-Hallucination', 'Hallucination', 'bbox', 'Tool-Grounding'],
      },
    ],
    expectedChunkIds: ['ai-c7'],
    relevanceGrades: { 'ai-c7': 3 },
    notes: 'Câu hỏi ngữ nghĩa về Anti-Hallucination.',
  },

  // ─── Nhóm B: Exact Technical (9 câu — công thức, ký hiệu, mã, thông số bảng) ─
  {
    id: 'q-ext-01',
    category: 'exact_technical',
    subjectName: 'Hệ điều hành',
    question: 'Viết công thức tính ma trận Need[i][j] trong thuật toán Banker.',
    semanticQuery: 'công thức tính ma trận nhu cầu Need[i][j] trong thuật toán Banker',
    keywords: ['Need[i][j]', 'Max[i][j]', 'Allocation[i][j]', 'Banker'],
    decomposedSubQueries: [
      {
        semanticQuery: 'công thức Need[i][j] = Max[i][j] - Allocation[i][j] thuật toán Banker',
        keywords: ['Need[i][j]', 'Max[i][j]', 'Allocation[i][j]', 'Banker'],
      },
    ],
    expectedChunkIds: ['os-c4'],
    relevanceGrades: { 'os-c4': 3 },
    notes: 'Chứa ký hiệu mảng chính xác Need[i][j].',
  },
  {
    id: 'q-ext-02',
    category: 'exact_technical',
    subjectName: 'Hệ điều hành',
    question: 'Công thức tính Effective Access Time (EAT) khi có bộ đệm bảng trang TLB là gì?',
    semanticQuery: 'công thức tính Effective Access Time EAT với hệ số trúng TLB',
    keywords: ['EAT', 'TLB', 't_mem', 't_TLB'],
    decomposedSubQueries: [
      {
        semanticQuery: 'công thức Effective Access Time EAT phân trang với TLB',
        keywords: ['EAT', 'TLB', 'Paging'],
      },
    ],
    expectedChunkIds: ['os-c5'],
    relevanceGrades: { 'os-c5': 3 },
    notes: 'Công thức EAT chứa t_TLB và alpha.',
  },
  {
    id: 'q-ext-03',
    category: 'exact_technical',
    subjectName: 'Hệ điều hành',
    question: 'Đoạn mã C định nghĩa hàm wait(Semaphore *S) và signal(Semaphore *S) hoạt động như thế nào?',
    semanticQuery: 'mã nguồn C triển khai hàm wait và signal của Semaphore',
    keywords: ['wait(Semaphore *S)', 'signal(Semaphore *S)', 'Critical Section'],
    decomposedSubQueries: [
      {
        semanticQuery: 'code C hàm wait và signal thao tác trên Semaphore và Mutex',
        keywords: ['Semaphore', 'wait', 'signal', 'Mutex'],
      },
    ],
    expectedChunkIds: ['os-c7'],
    relevanceGrades: { 'os-c7': 3 },
    notes: 'Truy vấn chính xác tên hàm trong block code.',
  },
  {
    id: 'q-ext-04',
    category: 'exact_technical',
    subjectName: 'Cơ sở dữ liệu',
    question: 'Mức cô lập Repeatable Read ngăn được những lỗi nào và vẫn còn có thể gặp Phantom Read không?',
    semanticQuery: 'bảng mức cô lập SQL Repeatable Read Dirty Read Phantom Read',
    keywords: ['Repeatable Read', 'Dirty Read', 'Phantom Read'],
    decomposedSubQueries: [
      {
        semanticQuery: 'bảng so sánh Isolation Level cho Repeatable Read và Phantom Read',
        keywords: ['Repeatable Read', 'Dirty Read', 'Phantom Read', 'Serializable'],
      },
    ],
    expectedChunkIds: ['db-c4'],
    relevanceGrades: { 'db-c4': 3 },
    notes: 'Tra cứu chính xác ô dữ liệu trong bảng Markdown.',
  },
  {
    id: 'q-ext-05',
    category: 'exact_technical',
    subjectName: 'Cơ sở dữ liệu',
    question: 'Công thức hợp nhất điểm RRF với toán tử toàn văn PGroonga &@~ sử dụng k bằng bao nhiêu?',
    semanticQuery: 'công thức Reciprocal Rank Fusion RRF kết hợp pgvector và PGroonga',
    keywords: ['RRF', 'PGroonga', '&@~', 'k = 60'],
    decomposedSubQueries: [
      {
        semanticQuery: 'công thức RRF k = 60 hợp nhất pgvector và PGroonga &@~',
        keywords: ['RRF', 'k = 60', 'PGroonga', '&@~'],
      },
    ],
    expectedChunkIds: ['db-c6'],
    relevanceGrades: { 'db-c6': 3 },
    notes: 'Chứa toán tử đặc biệt &@~ và hằng số k = 60.',
  },
  {
    id: 'q-ext-06',
    category: 'exact_technical',
    subjectName: 'Mạng máy tính',
    question: 'Trong thiết lập kết nối TCP, gói tin SYN-ACK mang giá trị ack bằng bao nhiêu?',
    semanticQuery: 'giá trị seq và ack trong gói SYN và SYN-ACK của TCP 3-way Handshake',
    keywords: ['SYN-ACK', 'SYN', 'ack=x+1', '3-way Handshake'],
    decomposedSubQueries: [
      {
        semanticQuery: 'quy trình bắt tay 3 bước TCP với SYN và SYN-ACK',
        keywords: ['SYN', 'SYN-ACK', 'ACK', '3-way Handshake'],
      },
    ],
    expectedChunkIds: ['net-c1'],
    relevanceGrades: { 'net-c1': 3 },
    notes: 'Chi tiết kỹ thuật chính xác trong gói SYN-ACK.',
  },
  {
    id: 'q-ext-07',
    category: 'exact_technical',
    subjectName: 'Mạng máy tính',
    question: 'Công thức tính số địa chỉ IP khả dụng cho host trong mạng con CIDR /x là gì?',
    semanticQuery: 'công thức tính số host khả dụng cho tiền tố CIDR /x',
    keywords: ['CIDR', '2^(32 - x) - 2', 'broadcast', 'IPv4'],
    decomposedSubQueries: [
      {
        semanticQuery: 'công thức CIDR tính số lượng địa chỉ IP host 2^(32 - x) - 2',
        keywords: ['CIDR', '2^(32 - x) - 2', 'broadcast'],
      },
    ],
    expectedChunkIds: ['net-c6'],
    relevanceGrades: { 'net-c6': 3 },
    notes: 'Tra cứu công thức mạng con CIDR.',
  },
  {
    id: 'q-ext-08',
    category: 'exact_technical',
    subjectName: 'Trí tuệ nhân tạo',
    question: 'Công thức Scaled Dot-Product Attention(Q, K, V) có mẫu số là gì và vì sao cần chia?',
    semanticQuery: 'công thức Scaled Dot-Product Attention Q K V với sqrt(d_k)',
    keywords: ['Attention(Q, K, V)', 'softmax', 'sqrt(d_k)', 'Self-Attention'],
    decomposedSubQueries: [
      {
        semanticQuery: 'công thức Self-Attention Q K V softmax và vai trò hệ số chia sqrt(d_k)',
        keywords: ['Self-Attention', 'Q, K, V', 'softmax', 'sqrt(d_k)'],
      },
    ],
    expectedChunkIds: ['ai-c1'],
    relevanceGrades: { 'ai-c1': 3 },
    notes: 'Chứa tên ký hiệu toán học Q, K, V và sqrt(d_k).',
  },
  {
    id: 'q-ext-09',
    category: 'exact_technical',
    subjectName: 'Trí tuệ nhân tạo',
    question: 'Trong thuật toán SM-2 biến thể Anki, giá trị tối thiểu của ease_factor (EF) bị chặn ở mức nào?',
    semanticQuery: 'công thức cập nhật ease_factor EF và ngưỡng chặn dưới 1.3 trong SM-2',
    keywords: ['SM-2', 'ease_factor', 'EF', '1.3', 'Anki'],
    decomposedSubQueries: [
      {
        semanticQuery: 'công thức cập nhật hệ số dễ EF trong SM-2 biến thể Anki',
        keywords: ['SM-2', 'ease_factor', 'EF', 'Anki'],
      },
    ],
    expectedChunkIds: ['ai-c5'],
    relevanceGrades: { 'ai-c5': 3 },
    notes: 'Tìm chính xác hằng số 1.3 trong công thức SM-2.',
  },

  // ─── Nhóm C: Bilingual & Acronym (8 câu — viết tắt & thuật ngữ chéo Việt-Anh) ─
  {
    id: 'q-bil-01',
    category: 'bilingual_acronym',
    subjectName: 'Hệ điều hành',
    question: 'Thuật toán lập lịch CPU RR hoạt động dựa trên lát cắt thời gian nào?',
    semanticQuery: 'thuật toán điều phối RR chia lát cắt thời gian cho từng tiến trình',
    keywords: ['RR', 'lát cắt'],
    decomposedSubQueries: [
      {
        semanticQuery: 'thuật toán lập lịch CPU Round-Robin và time quantum q FIFO',
        keywords: ['Round-Robin', 'time quantum', 'FIFO'],
      },
    ],
    expectedChunkIds: ['os-c1'],
    relevanceGrades: { 'os-c1': 3 },
    notes: 'Viết tắt RR cần mở rộng thành Round-Robin và time quantum.',
  },
  {
    id: 'q-bil-02',
    category: 'bilingual_acronym',
    subjectName: 'Cơ sở dữ liệu',
    question: 'Trong CSDL quan hệ, tính toàn vẹn tham chiếu được duy trì bằng cặp khóa chính và khóa ngoại nào?',
    semanticQuery: 'cơ sở dữ liệu quan hệ duy trì liên kết bảng qua khóa chính và khóa ngoại',
    keywords: ['CSDL quan hệ', 'khóa chính', 'khóa ngoại'],
    decomposedSubQueries: [
      {
        semanticQuery:
          'Relational Database Management System RDBMS dùng Primary Key và Foreign Key',
        keywords: ['RDBMS', 'Primary Key', 'Foreign Key', 'Relational Database'],
      },
    ],
    expectedChunkIds: ['db-c1'],
    relevanceGrades: { 'db-c1': 3 },
    notes: 'Thuật ngữ tiếng Việt "CSDL quan hệ / khóa chính / khóa ngoại" cần mở rộng sang RDBMS / Primary Key / Foreign Key.',
  },
  {
    id: 'q-bil-03',
    category: 'bilingual_acronym',
    subjectName: 'Cơ sở dữ liệu',
    question: 'Tại sao tìm kiếm láng giềng gần nhất xấp xỉ lại nhanh hơn quét tuần tự toàn bộ vector?',
    semanticQuery: 'đồ thị nhiều tầng tìm láng giềng gần nhất xấp xỉ nhanh hơn quét tuần tự',
    keywords: ['láng giềng gần nhất', 'xấp xỉ'],
    decomposedSubQueries: [
      {
        semanticQuery: 'chỉ mục đồ thị phân tầng HNSW cho truy vấn Approximate Nearest Neighbor ANN',
        keywords: ['HNSW', 'ANN', 'ef_construction', 'Cosine'],
      },
    ],
    expectedChunkIds: ['db-c7'],
    relevanceGrades: { 'db-c7': 3 },
    notes: 'Thuật ngữ tiếng Việt "láng giềng gần nhất xấp xỉ" cần liên kết tới Approximate Nearest Neighbor (ANN) & HNSW.',
  },
  {
    id: 'q-bil-04',
    category: 'bilingual_acronym',
    subjectName: 'Mạng máy tính',
    question: 'Giao thức định tuyến nội miền IGP nào dùng bản tin LSA để chạy giải thuật đường đi ngắn nhất?',
    semanticQuery: 'giao thức định tuyến nội miền IGP dùng LSA tìm đường đi tối ưu',
    keywords: ['IGP', 'LSA', 'nội miền'],
    decomposedSubQueries: [
      {
        semanticQuery: 'giao thức định tuyến trạng thái liên kết OSPF dùng LSA và thuật toán Dijkstra',
        keywords: ['OSPF', 'Dijkstra', 'LSA', 'Link-State', 'IGP'],
      },
    ],
    expectedChunkIds: ['net-c5'],
    relevanceGrades: { 'net-c5': 3 },
    notes: 'Mở rộng IGP + LSA sang OSPF và Dijkstra.',
  },
  {
    id: 'q-bil-05',
    category: 'bilingual_acronym',
    subjectName: 'Mạng máy tính',
    question: 'Các bản ghi AAAA, CNAME và MX thuộc về hệ thống danh bạ phân cấp nào của Internet?',
    semanticQuery: 'hệ thống danh bạ phân cấp ánh xạ tên miền dùng bản ghi AAAA CNAME MX',
    keywords: ['AAAA', 'CNAME', 'MX'],
    decomposedSubQueries: [
      {
        semanticQuery: 'hệ thống phân giải tên miền DNS quản lý bản ghi AAAA CNAME MX và TTL',
        keywords: ['DNS', 'CNAME', 'MX', 'TTL', 'TLD'],
      },
    ],
    expectedChunkIds: ['net-c7'],
    relevanceGrades: { 'net-c7': 3 },
    notes: 'Cần mở rộng sang DNS và TTL.',
  },
  {
    id: 'q-bil-06',
    category: 'bilingual_acronym',
    subjectName: 'Kỹ thuật phần mềm',
    question: 'Nguyên lý đảo ngược phụ thuộc (DIP) và đóng/mở (OCP) quy định điều gì?',
    semanticQuery: 'nguyên lý đảo ngược phụ thuộc và đóng mở cho mô đun phần mềm',
    keywords: ['đảo ngược phụ thuộc', 'đóng/mở'],
    decomposedSubQueries: [
      {
        semanticQuery: 'nguyên lý SOLID gồm SRP OCP và DIP Dependency Inversion Principle',
        keywords: ['SOLID', 'DIP', 'OCP', 'SRP', 'Dependency Inversion'],
      },
    ],
    expectedChunkIds: ['se-c2'],
    relevanceGrades: { 'se-c2': 3 },
    notes: 'Chuyển DIP/OCP Việt-Anh sang SOLID & Dependency Inversion.',
  },
  {
    id: 'q-bil-07',
    category: 'bilingual_acronym',
    subjectName: 'Kỹ thuật phần mềm',
    question: 'Kiến trúc FSD quy định chiều nhập khẩu giữa các tầng và giao diện công khai ra sao?',
    semanticQuery: 'quy tắc phân tầng một chiều và giao diện công khai trong kiến trúc giao diện',
    keywords: ['FSD', 'nhập khẩu', 'giao diện công khai'],
    decomposedSubQueries: [
      {
        semanticQuery: 'Feature-Sliced Design FSD phân tầng app pages widgets features entities shared Public API',
        keywords: ['FSD', 'Feature-Sliced Design', 'Public API', 'widgets', 'entities'],
      },
    ],
    expectedChunkIds: ['se-c6'],
    relevanceGrades: { 'se-c6': 3 },
    notes: 'Mở rộng FSD và "giao diện công khai" thành Feature-Sliced Design & Public API.',
  },
  {
    id: 'q-bil-08',
    category: 'bilingual_acronym',
    subjectName: 'Kỹ thuật phần mềm',
    question: 'Làm sao ánh xạ JSON kiểu gạch dưới từ máy chủ sang kiểu lạc đà ở tầng dịch vụ khách?',
    semanticQuery: 'chuyển đổi định dạng dữ liệu gạch dưới sang lạc đà tại tầng dịch vụ khách',
    keywords: ['gạch dưới', 'lạc đà', 'máy chủ'],
    decomposedSubQueries: [
      {
        semanticQuery: 'mẫu DTO Mapping chuyển snake_case sang camelCase trong Service Layer',
        keywords: ['DTO Mapping', 'snake_case', 'camelCase', 'Service Layer'],
      },
    ],
    expectedChunkIds: ['se-c7'],
    relevanceGrades: { 'se-c7': 3 },
    notes: 'Liên kết thuật ngữ Việt-Anh: gạch dưới/lạc đà -> snake_case/camelCase/DTO Mapping.',
  },

  // ─── Nhóm D: Multi-Hop & Comparison (9 câu — đa ý, cần Query Decomposition) ──
  {
    id: 'q-mul-01',
    category: 'multi_hop_comparison',
    subjectName: 'Hệ điều hành',
    question:
      'So sánh nguy cơ bỏ đói tiến trình giữa SJF với Round-Robin, đồng thời nêu 4 điều kiện gây ra Deadlock.',
    semanticQuery:
      'so sánh nguy cơ starvation giữa SJF và Round-Robin cùng bốn điều kiện xảy ra Deadlock',
    keywords: ['SJF', 'Round-Robin', 'Deadlock'],
    decomposedSubQueries: [
      {
        semanticQuery: 'bảng so sánh nguy cơ Starvation của SJF và Round-Robin trong lập lịch CPU',
        keywords: ['SJF', 'Round-Robin', 'Starvation', 'Preemptive'],
      },
      {
        semanticQuery: 'bốn điều kiện Coffman gây ra Deadlock trong hệ điều hành',
        keywords: ['Deadlock', 'Coffman', 'Mutual Exclusion', 'Circular Wait'],
      },
    ],
    expectedChunkIds: ['os-c2', 'os-c3'],
    relevanceGrades: { 'os-c2': 3, 'os-c3': 3 },
    notes: 'Câu hỏi ghép 2 chương tách biệt trong Giáo trình Hệ điều hành.',
  },
  {
    id: 'q-mul-02',
    category: 'multi_hop_comparison',
    subjectName: 'Hệ điều hành',
    question:
      'Phân biệt bộ nhớ đệm TLB trong phân trang với hiện tượng Thrashing khi thiếu bộ nhớ vật lý.',
    semanticQuery:
      'phân biệt bộ nhớ đệm TLB khi phân trang và hiện tượng Thrashing gây lỗi trang liên tục',
    keywords: ['TLB', 'Thrashing', 'phân trang'],
    decomposedSubQueries: [
      {
        semanticQuery: 'cơ chế phân trang Paging và công thức EAT của bộ đệm TLB',
        keywords: ['Paging', 'TLB', 'EAT'],
      },
      {
        semanticQuery: 'hiện tượng Thrashing do tỷ lệ Page Fault cao và swapping liên tục',
        keywords: ['Thrashing', 'Page Fault', 'swapping'],
      },
    ],
    expectedChunkIds: ['os-c5', 'os-c6'],
    relevanceGrades: { 'os-c5': 3, 'os-c6': 3 },
    notes: 'Đòi hỏi truy xuất đủ cả os-c5 và os-c6.',
  },
  {
    id: 'q-mul-03',
    category: 'multi_hop_comparison',
    subjectName: 'Cơ sở dữ liệu',
    question:
      'So sánh khả năng truy vấn khoảng của B+Tree Index với Hash Index và giải thích cách RRF kết hợp tìm kiếm toàn văn PGroonga.',
    semanticQuery:
      'so sánh B+Tree Index với Hash Index đồng thời giải thích thuật toán RRF cho PGroonga và pgvector',
    keywords: ['B+Tree', 'Hash Index', 'RRF', 'PGroonga'],
    decomposedSubQueries: [
      {
        semanticQuery: 'so sánh truy vấn khoảng của B+Tree Index và Hash Index',
        keywords: ['B+Tree', 'Hash Index', 'BETWEEN', 'O(log n)'],
      },
      {
        semanticQuery: 'công thức RRF k=60 kết hợp pgvector và PGroonga',
        keywords: ['RRF', 'PGroonga', 'pgvector', 'k = 60'],
      },
    ],
    expectedChunkIds: ['db-c5', 'db-c6'],
    relevanceGrades: { 'db-c5': 3, 'db-c6': 3 },
    notes: 'Kết hợp Chương 4 (Index) và Chương 5 (RRF).',
  },
  {
    id: 'q-mul-04',
    category: 'multi_hop_comparison',
    subjectName: 'Cơ sở dữ liệu',
    question:
      'Trình bày 4 tính chất ACID của giao dịch và đối chiếu các hiện tượng bất thường trên bảng Isolation Level.',
    semanticQuery:
      'trình bày 4 tính chất ACID và đối chiếu lỗi Dirty Read Phantom Read theo từng Isolation Level',
    keywords: ['ACID', 'Isolation Level', 'Dirty Read'],
    decomposedSubQueries: [
      {
        semanticQuery: 'bốn tính chất ACID Atomicity Consistency Isolation Durability và WAL',
        keywords: ['ACID', 'Atomicity', 'Durability', 'WAL'],
      },
      {
        semanticQuery: 'bảng mức độ cô lập SQL Read Committed Repeatable Read Serializable',
        keywords: ['Read Committed', 'Repeatable Read', 'Serializable', 'Phantom Read'],
      },
    ],
    expectedChunkIds: ['db-c3', 'db-c4'],
    relevanceGrades: { 'db-c3': 3, 'db-c4': 3 },
    notes: 'Đòi hỏi lấy cả phần lý thuyết ACID lẫn bảng mức cô lập.',
  },
  {
    id: 'q-mul-05',
    category: 'multi_hop_comparison',
    subjectName: 'Mạng máy tính',
    question:
      'So sánh cơ chế kiểm soát tắc nghẽn AIMD của TCP với lý do HTTP/3 chuyển sang dùng QUIC trên UDP.',
    semanticQuery:
      'so sánh kiểm soát tắc nghẽn AIMD trong TCP và lý do HTTP/3 dùng QUIC trên UDP',
    keywords: ['AIMD', 'TCP', 'HTTP/3', 'QUIC'],
    decomposedSubQueries: [
      {
        semanticQuery: 'cơ chế Slow Start và AIMD cwnd kiểm soát tắc nghẽn TCP',
        keywords: ['cwnd', 'Slow Start', 'AIMD', 'ssthresh'],
      },
      {
        semanticQuery: 'HTTP/3 chạy trên QUIC UDP giải quyết lỗi Head-of-Line Blocking',
        keywords: ['HTTP/3', 'QUIC', 'UDP', 'Head-of-Line Blocking'],
      },
    ],
    expectedChunkIds: ['net-c3', 'net-c4'],
    relevanceGrades: { 'net-c3': 3, 'net-c4': 3 },
    notes: 'Truy vấn đa chương trong sách Mạng máy tính.',
  },
  {
    id: 'q-mul-06',
    category: 'multi_hop_comparison',
    subjectName: 'Mạng máy tính',
    question:
      'Giải thích sự khác nhau về header giữa TCP và UDP, đồng thời mô tả cách giao thức OSPF tìm đường đi ngắn nhất.',
    semanticQuery:
      'khác biệt kích thước header TCP và UDP cùng cách OSPF dùng Dijkstra tìm đường ngắn nhất',
    keywords: ['TCP', 'UDP', 'OSPF'],
    decomposedSubQueries: [
      {
        semanticQuery: 'bảng so sánh TCP và UDP về kết nối độ tin cậy và kích thước header',
        keywords: ['TCP', 'UDP', '20 bytes', '8 bytes'],
      },
      {
        semanticQuery: 'giao thức định tuyến OSPF phát tán LSA và chạy Dijkstra',
        keywords: ['OSPF', 'Dijkstra', 'LSA', 'Link-State'],
      },
    ],
    expectedChunkIds: ['net-c2', 'net-c5'],
    relevanceGrades: { 'net-c2': 3, 'net-c5': 3 },
    notes: 'Tách 2 subQuery thuộc tầng Giao vận và tầng Mạng.',
  },
  {
    id: 'q-mul-07',
    category: 'multi_hop_comparison',
    subjectName: 'Kỹ thuật phần mềm',
    question:
      'Kết hợp kiến trúc Hexagonal ở tầng Domain với mẫu Cầu dao ngắt mạch và hàng đợi nền bất đồng bộ để đảm bảo độ tin cậy Backend.',
    semanticQuery:
      'kết hợp kiến trúc Hexagonal tầng Domain với cơ chế cầu dao ngắt mạch và xử lý hàng đợi bất đồng bộ cho Backend tin cậy',
    keywords: ['Hexagonal', 'Domain', 'độ tin cậy Backend'],
    decomposedSubQueries: [
      {
        semanticQuery: 'kiến trúc Hexagonal Ports and Adapters và Dependency Rule tầng Domain',
        keywords: ['Hexagonal', 'Clean Architecture', 'Ports', 'Adapters'],
      },
      {
        semanticQuery: 'mẫu Circuit Breaker cô lập lỗi khi gọi dịch vụ ngoài',
        keywords: ['Circuit Breaker', 'Cascading Failure', 'Fallback'],
      },
      {
        semanticQuery: 'hàng đợi bất đồng bộ Redis BullMQ Exponential Backoff tránh HTTP Timeout',
        keywords: ['BullMQ', 'Redis', 'Exponential Backoff'],
      },
    ],
    expectedChunkIds: ['se-c1', 'se-c3', 'se-c4'],
    relevanceGrades: { 'se-c1': 3, 'se-c3': 3, 'se-c4': 2 },
    notes: 'Truy vấn 3 ý kiến trúc Backend.',
  },
  {
    id: 'q-mul-08',
    category: 'multi_hop_comparison',
    subjectName: 'Trí tuệ nhân tạo',
    question:
      'So sánh vai trò của Bi-Encoder với Cross-Encoder trong Reranking và lợi ích của Query Decomposition đối với câu hỏi phức tạp.',
    semanticQuery:
      'so sánh Bi-Encoder với Cross-Encoder trong Reranking và vai trò của Query Decomposition',
    keywords: ['Bi-Encoder', 'Cross-Encoder', 'Query Decomposition'],
    decomposedSubQueries: [
      {
        semanticQuery: 'so sánh Bi-Encoder và Cross-Encoder bge-reranker-v2-m3 khi Reranking',
        keywords: ['Bi-Encoder', 'Cross-Encoder', 'bge-reranker-v2-m3', 'Reranking'],
      },
      {
        semanticQuery: 'kỹ thuật Query Decomposition chia nhỏ câu hỏi phức hợp tránh loãng ngữ nghĩa',
        keywords: ['Query Decomposition', 'sub-queries', 'loãng ngữ nghĩa'],
      },
    ],
    expectedChunkIds: ['ai-c2', 'ai-c3'],
    relevanceGrades: { 'ai-c2': 3, 'ai-c3': 3 },
    notes: 'Đo Recall@5 khi phải lấy đủ cả 2 chunk kiến trúc RAG.',
  },
  {
    id: 'q-mul-09',
    category: 'multi_hop_comparison',
    subjectName: 'Trí tuệ nhân tạo',
    question:
      'Kết hợp thuật toán lặp lại ngắt quãng SM-2 với các cấp độ nhận thức trong thang Bloom để xây dựng hệ thống ôn thi thích ứng.',
    semanticQuery:
      'kết hợp thuật toán SM-2 biến thể Anki với thang nhận thức Bloom cho hệ thống ôn thi',
    keywords: ['SM-2', 'Bloom', 'ôn thi'],
    decomposedSubQueries: [
      {
        semanticQuery: 'thuật toán lặp lại ngắt quãng SM-2 Anki và công thức ease_factor',
        keywords: ['SM-2', 'Anki', 'ease_factor', 'Ebbinghaus'],
      },
      {
        semanticQuery: 'bốn cấp độ thang nhận thức Bloom Remember Understand Apply Analyze',
        keywords: ['Bloom', 'Remember', 'Understand', 'Apply', 'Analyze'],
      },
    ],
    expectedChunkIds: ['ai-c5', 'ai-c6'],
    relevanceGrades: { 'ai-c5': 3, 'ai-c6': 3 },
    notes: 'Liên kết 2 chunk cốt lõi của AI-StudyMate.',
  },

  // ─── Nhóm E: Out-of-Scope Traps (6 câu — câu hỏi bẫy ngoài phạm vi tài liệu) ──
  {
    id: 'q-oos-01',
    category: 'out_of_scope_trap',
    subjectName: 'Hệ điều hành',
    question: 'Giá niêm yết của bản quyền Windows 11 Pro tại thị trường Việt Nam năm 2026 là bao nhiêu?',
    semanticQuery: 'giá bán bản quyền hệ điều hành Windows 11 Pro tại Việt Nam năm 2026',
    keywords: ['giá bán', 'Windows 11 Pro', 'Việt Nam'],
    decomposedSubQueries: [
      {
        semanticQuery: 'giá bán bản quyền hệ điều hành Windows 11 Pro tại Việt Nam',
        keywords: ['Windows 11 Pro', 'giá bản quyền'],
      },
    ],
    expectedChunkIds: [],
    relevanceGrades: {},
    notes: 'Câu hỏi bẫy giá thương mại, không tồn tại trong giáo trình Hệ điều hành.',
  },
  {
    id: 'q-oos-02',
    category: 'out_of_scope_trap',
    subjectName: 'Cơ sở dữ liệu',
    question: 'Cách cấu hình cụm Apache Cassandra multi-datacenter bằng tệp cassandra.yaml chi tiết ra sao?',
    semanticQuery: 'cấu hình cụm NoSQL Apache Cassandra multi-datacenter trong tệp cassandra.yaml',
    keywords: ['Apache Cassandra', 'cassandra.yaml', 'multi-datacenter'],
    decomposedSubQueries: [
      {
        semanticQuery: 'cấu hình tệp cassandra.yaml cho cụm Apache Cassandra nhiều trung tâm dữ liệu',
        keywords: ['Apache Cassandra', 'cassandra.yaml'],
      },
    ],
    expectedChunkIds: [],
    relevanceGrades: {},
    notes: 'Tài liệu CSDL chỉ nói về RDBMS/SQL/PGroonga, không có nội dung Cassandra.',
  },
  {
    id: 'q-oos-03',
    category: 'out_of_scope_trap',
    subjectName: 'Mạng máy tính',
    question: 'Thông số tần số sóng vô tuyến và kỹ thuật điều chế beamforming của mạng vệ tinh Starlink V3 là gì?',
    semanticQuery: 'kỹ thuật điều chế beamforming và tần số vệ tinh Starlink V3',
    keywords: ['Starlink V3', 'beamforming', 'vệ tinh'],
    decomposedSubQueries: [
      {
        semanticQuery: 'tần số vô tuyến và beamforming của hệ thống vệ tinh Starlink V3',
        keywords: ['Starlink V3', 'beamforming'],
      },
    ],
    expectedChunkIds: [],
    relevanceGrades: {},
    notes: 'Ngoài phạm vi giáo trình Mạng máy tính.',
  },
  {
    id: 'q-oos-04',
    category: 'out_of_scope_trap',
    subjectName: 'Kỹ thuật phần mềm',
    question: 'Cú pháp khai báo macro derive trong ngôn ngữ Rust với thư viện Serde hoạt động như thế nào?',
    semanticQuery: 'cú pháp viết procedural macro derive với Serde trong ngôn ngữ lập trình Rust',
    keywords: ['Rust', 'Serde', 'derive macro'],
    decomposedSubQueries: [
      {
        semanticQuery: 'cú pháp macro derive và thư viện Serde trong ngôn ngữ Rust',
        keywords: ['Rust', 'Serde', 'macro'],
      },
    ],
    expectedChunkIds: [],
    relevanceGrades: {},
    notes: 'Không có nội dung Rust trong giáo trình Kỹ thuật phần mềm.',
  },
  {
    id: 'q-oos-05',
    category: 'out_of_scope_trap',
    subjectName: 'Trí tuệ nhân tạo',
    question: 'Phác đồ điều trị y khoa mới nhất cho bệnh tiểu đường tuýp 2 theo khuyến cáo WHO là gì?',
    semanticQuery: 'phác đồ điều trị bệnh tiểu đường tuýp 2 theo tổ chức y tế thế giới WHO',
    keywords: ['tiểu đường', 'phác đồ điều trị', 'WHO'],
    decomposedSubQueries: [
      {
        semanticQuery: 'hướng dẫn y khoa điều trị bệnh tiểu đường tuýp 2 của WHO',
        keywords: ['tiểu đường', 'WHO', 'điều trị'],
      },
    ],
    expectedChunkIds: [],
    relevanceGrades: {},
    notes: 'Hoàn toàn ngoài miền tri thức CNTT.',
  },
  {
    id: 'q-oos-06',
    category: 'out_of_scope_trap',
    subjectName: 'Trí tuệ nhân tạo',
    question: 'Hãy cung cấp mã lệnh Dockerfile hoàn chỉnh để biên dịch nhân Linux bằng LLVM Clang trên ARM64.',
    semanticQuery: 'Dockerfile biên dịch Linux kernel bằng trình biên dịch LLVM Clang trên kiến trúc ARM64',
    keywords: ['Dockerfile', 'Linux kernel', 'LLVM Clang', 'ARM64'],
    decomposedSubQueries: [
      {
        semanticQuery: 'Dockerfile build nhân Linux kernel bằng LLVM Clang cho ARM64',
        keywords: ['Dockerfile', 'LLVM Clang', 'ARM64'],
      },
    ],
    expectedChunkIds: [],
    relevanceGrades: {},
    notes: 'Câu hỏi bẫy kỹ thuật chứa từ khóa CNTT nhưng không có trong Corpus.',
  },
];

export const CATEGORY_LABELS: Record<BenchmarkQueryCategory, string> = {
  semantic_lookup: 'Nhóm A: Tra cứu Ngữ nghĩa Đồng nghĩa',
  exact_technical: 'Nhóm B: Thuật ngữ, Công thức & Bảng biểu',
  bilingual_acronym: 'Nhóm C: Từ viết tắt & Đa ngữ Việt–Anh',
  multi_hop_comparison: 'Nhóm D: Câu hỏi Phức hợp So sánh Đa chương',
  out_of_scope_trap: 'Nhóm E: Bẫy Ngoài Phạm vi (Chống Ảo giác)',
};

export function getGoldenDatasetSummary(): GoldenDatasetSummary {
  const categoryCounts: Record<BenchmarkQueryCategory, number> = {
    semantic_lookup: 0,
    exact_technical: 0,
    bilingual_acronym: 0,
    multi_hop_comparison: 0,
    out_of_scope_trap: 0,
  };

  for (const query of GOLDEN_BENCHMARK_QUERIES) {
    categoryCounts[query.category] += 1;
  }

  return {
    version: GOLDEN_DATASET_VERSION,
    corpusDocumentCount: GOLDEN_CORPUS_DOCUMENTS.length,
    corpusChunkCount: GOLDEN_CORPUS_CHUNKS.length,
    totalQueries: GOLDEN_BENCHMARK_QUERIES.length,
    categoryCounts,
    documents: GOLDEN_CORPUS_DOCUMENTS,
    chunks: GOLDEN_CORPUS_CHUNKS,
    queries: GOLDEN_BENCHMARK_QUERIES,
  };
}
