export interface AuthenticationService {
  deleteToken(): Promise<void>;
  getToken(): Promise<null | string>;
  setToken(token: string): Promise<void>;
}
