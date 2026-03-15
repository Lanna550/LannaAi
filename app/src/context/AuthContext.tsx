import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL, fetchWithTimeout, readJsonSafely } from '@/lib/api';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  avatar: string;
  banner?: string;
  location?: string;
  website?: string;
  createdAt: string;
}

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (username: string, email: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  updateUser: (updates: Partial<User>) => Promise<AuthResult>;
  uploadProfileMedia: (files: { avatar?: File; banner?: File }) => Promise<AuthResult>;
  updateAvatar: (avatarUrl: string) => Promise<AuthResult>;
  refreshUser: () => Promise<void>;
}

interface AuthApiResponse {
  user?: Partial<User>;
  error?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_AVATAR = 'images/avatar1.jpg';
const DEFAULT_BIO = '';
const LEGACY_DEFAULT_BIO = 'Halo! Aku suka anime!';
const STORAGE_KEY = 'lanna-user';

function resolveAssetUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  if (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:')
  ) {
    return value;
  }

  if (value.startsWith('/uploads/')) {
    return `${API_BASE_URL}${value}`;
  }

  return value;
}

function normalizeUser(rawUser: Partial<User> | null | undefined): User {
  const normalizedBio =
    typeof rawUser?.bio === 'string' && rawUser.bio.trim() !== LEGACY_DEFAULT_BIO
      ? rawUser.bio
      : DEFAULT_BIO;

  return {
    id: String(rawUser?.id || ''),
    username: String(rawUser?.username || ''),
    email: String(rawUser?.email || ''),
    displayName: String(rawUser?.displayName || rawUser?.username || ''),
    bio: normalizedBio,
    avatar: String(resolveAssetUrl(rawUser?.avatar) || DEFAULT_AVATAR),
    banner: resolveAssetUrl(rawUser?.banner),
    location: typeof rawUser?.location === 'string' ? rawUser.location : undefined,
    website: typeof rawUser?.website === 'string' ? rawUser.website : undefined,
    createdAt: String(rawUser?.createdAt || new Date().toISOString()),
  };
}

async function readUserResponse(response: Response): Promise<{ user?: User; error?: string }> {
  const data = await readJsonSafely<AuthApiResponse>(response);
  if (!response.ok) {
    return {
      error:
        data?.error ||
        (response.status === 404
          ? 'User tidak ditemukan. Silakan login ulang jika akun lama berubah.'
          : response.status >= 500
            ? 'Backend user gagal. Periksa server dan MySQL XAMPP.'
            : 'Permintaan user gagal.'),
    };
  }

  if (!data?.user) {
    return {
      error: 'Data user dari server tidak valid.',
    };
  }

  return {
    user: normalizeUser(data.user),
  };
}

async function sendAuthRequest(
  endpoint: string,
  payload: Record<string, string>,
): Promise<{ user?: User; error?: string }> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return readUserResponse(response);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        error: 'Backend auth timeout. Periksa koneksi server/ngrok dan coba lagi.',
      };
    }

    throw error;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistUser = (nextUser: User | null) => {
    setUser(nextUser);

    if (nextUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const findUserByEmail = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const response = await fetchWithTimeout(
      `${API_BASE_URL}/api/users?email=${encodeURIComponent(normalizedEmail)}`,
    );
    const result = await readUserResponse(response);
    return result.user || null;
  };

  const resolveCurrentUser = async (baseUser?: User | null) => {
    const candidateUser = baseUser || user;
    if (!candidateUser) {
      return null;
    }

    if (candidateUser.id) {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/${candidateUser.id}`);
      const result = await readUserResponse(response);
      if (result.user) {
        const normalized = normalizeUser({
          ...candidateUser,
          ...result.user,
        });
        persistUser(normalized);
        return normalized;
      }
    }

    if (candidateUser.email) {
      const resolvedByEmail = await findUserByEmail(candidateUser.email);
      if (resolvedByEmail) {
        const normalized = normalizeUser({
          ...candidateUser,
          ...resolvedByEmail,
        });
        persistUser(normalized);
        return normalized;
      }
    }

    return null;
  };

  const refreshUser = async () => {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    if (!savedUser) {
      return;
    }

    try {
      const parsedUser = normalizeUser(JSON.parse(savedUser) as Partial<User>);
      if (!parsedUser.id) {
        return;
      }

      await resolveCurrentUser(parsedUser);
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY);
    if (savedUser) {
      try {
        const parsedUser = normalizeUser(JSON.parse(savedUser) as Partial<User>);
        persistUser(parsedUser);
        void refreshUser();
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<AuthResult> => {
    setIsLoading(true);

    try {
      const result = await sendAuthRequest('/api/auth/login', { email, password });
      if (!result.user) {
        return {
          success: false,
          error: result.error || 'Email atau password salah.',
        };
      }

      persistUser(result.user);
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Tidak bisa terhubung ke backend auth.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    username: string,
    email: string,
    password: string,
  ): Promise<AuthResult> => {
    setIsLoading(true);

    try {
      const result = await sendAuthRequest('/api/auth/register', {
        username,
        email,
        password,
      });

      if (!result.user) {
        return {
          success: false,
          error: result.error || 'Registrasi gagal.',
        };
      }

      persistUser(result.user);
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Tidak bisa terhubung ke backend auth.',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    persistUser(null);
  };

  const updateUser = async (updates: Partial<User>): Promise<AuthResult> => {
    const activeUser = await resolveCurrentUser();
    if (!activeUser?.id) {
      return {
        success: false,
        error: 'User belum login.',
      };
    }

    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/${activeUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          displayName: updates.displayName ?? activeUser.displayName,
          bio: updates.bio ?? activeUser.bio,
        }),
      });

      const result = await readUserResponse(response);
      if (!result.user) {
        return {
          success: false,
          error: result.error || 'Gagal menyimpan profil.',
        };
      }

      persistUser(
        normalizeUser({
          ...activeUser,
          ...updates,
          ...result.user,
        }),
      );
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Tidak bisa terhubung ke backend profil.',
      };
    }
  };

  const uploadProfileMedia = async (files: {
    avatar?: File;
    banner?: File;
  }): Promise<AuthResult> => {
    const activeUser = await resolveCurrentUser();
    if (!activeUser?.id) {
      return {
        success: false,
        error: 'User belum login.',
      };
    }

    if (!files.avatar && !files.banner) {
      return {
        success: false,
        error: 'Tidak ada file yang dikirim.',
      };
    }

    try {
      const formData = new FormData();
      if (files.avatar) {
        formData.append('avatar', files.avatar, files.avatar.name);
      }
      if (files.banner) {
        formData.append('banner', files.banner, files.banner.name);
      }

      const response = await fetchWithTimeout(`${API_BASE_URL}/api/users/${activeUser.id}/media`, {
        method: 'POST',
        body: formData,
      });

      const result = await readUserResponse(response);
      if (!result.user) {
        return {
          success: false,
          error: result.error || 'Gagal mengunggah media profil.',
        };
      }

      persistUser(
        normalizeUser({
          ...activeUser,
          ...result.user,
        }),
      );
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Tidak bisa terhubung ke backend upload profil.',
      };
    }
  };

  const updateAvatar = async (avatarUrl: string): Promise<AuthResult> => {
    if (!user) {
      return {
        success: false,
        error: 'User belum login.',
      };
    }

    persistUser(normalizeUser({ ...user, avatar: avatarUrl }));
    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        updateUser,
        uploadProfileMedia,
        updateAvatar,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
