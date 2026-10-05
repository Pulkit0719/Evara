// Placeholder for your authentication SDK
// Replace this with your own authentication implementation

export const sdk = {
  // Authentication methods - implement these according to your auth system
  exchangeCodeForToken: async (code: string, state: string) => {
    throw new Error('Not implemented: add your OAuth token exchange logic');
  },
  
  getUserInfo: async (accessToken: string) => {
    throw new Error('Not implemented: add your user info retrieval logic');
  },
  
  createSessionToken: async (openId: string, options: { expiresInMs?: number; name?: string }) => {
    throw new Error('Not implemented: add your session token creation logic');
  },
  
  verifySession: async (cookieValue: string | undefined | null) => {
    throw new Error('Not implemented: add your session verification logic');
  },
  
  getUserInfoWithJwt: async (jwtToken: string) => {
    throw new Error('Not implemented: add your JWT user info logic');
  },
  
  authenticateRequest: async (req: any) => {
    throw new Error('Not implemented: add your request authentication logic');
  }
};

// Export types for compatibility
export type AuthenticatedUser = {
  id: number;
  openId: string;
  email?: string;
  name?: string;
  loginMethod?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
  taskUid?: string;
  isCron?: boolean;
};

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

