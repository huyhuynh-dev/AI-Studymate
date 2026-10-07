'use client';

import useSWR from 'swr';
import {
  subjectsApi,
  Subject,
  CreateSubjectDto,
  UpdateSubjectDto,
  extractApiErrorMessage,
} from '@/services/subjects.api';

export const SUBJECTS_CACHE_KEY = '/subjects';

export function useSubjects() {
  const {
    data: subjects = [],
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<Subject[]>(SUBJECTS_CACHE_KEY, () => subjectsApi.getAllSubjects(), {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 3000,
  });

  /**
   * Tạo không gian học tập mới với Optimistic UI
   */
  const createSubject = async (dto: CreateSubjectDto): Promise<Subject> => {
    let createdItem: Subject | null = null;

    try {
      await mutate(
        async (current = []) => {
          const created = await subjectsApi.createSubject(dto);
          createdItem = created;
          return [created, ...current];
        },
        {
          optimisticData: (current = []) => [
            {
              id: `temp-${Date.now()}`,
              name: dto.name,
              color: dto.color || '#4F46E5',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            ...current,
          ],
          rollbackOnError: true,
          revalidate: false,
        }
      );

      return createdItem!;
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Không thể tạo không gian học tập'));
    }
  };

  /**
   * Cập nhật thông tin không gian học tập với Optimistic UI
   */
  const updateSubject = async (
    id: string,
    dto: UpdateSubjectDto
  ): Promise<Subject> => {
    let updatedItem: Subject | null = null;

    try {
      await mutate(
        async (current = []) => {
          const updated = await subjectsApi.updateSubject(id, dto);
          updatedItem = updated;
          return current.map((item) => (item.id === id ? updated : item));
        },
        {
          optimisticData: (current = []) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    ...dto,
                    updated_at: new Date().toISOString(),
                  }
                : item
            ),
          rollbackOnError: true,
          revalidate: false,
        }
      );

      return updatedItem!;
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Không thể cập nhật không gian học tập'));
    }
  };

  /**
   * Xóa không gian học tập với Optimistic UI
   */
  const deleteSubject = async (id: string): Promise<void> => {
    try {
      await mutate(
        async (current = []) => {
          await subjectsApi.deleteSubject(id);
          return current.filter((item) => item.id !== id);
        },
        {
          optimisticData: (current = []) => current.filter((item) => item.id !== id),
          rollbackOnError: true,
          revalidate: false,
        }
      );
    } catch (err) {
      throw new Error(extractApiErrorMessage(err, 'Không thể xóa không gian học tập'));
    }
  };

  return {
    subjects,
    isLoading,
    isValidating,
    error: error ? extractApiErrorMessage(error, 'Lỗi tải danh sách không gian học tập') : null,
    createSubject,
    updateSubject,
    deleteSubject,
    refresh: () => mutate(),
  };
}
