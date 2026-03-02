import { AuthenticationServiceImpl } from './authentication/AuthenticationServiceImpl.js';
import { StorageImpl } from './storage/StorageImp.js';

const storage = new StorageImpl();
const authenticationService = new AuthenticationServiceImpl({ storage });

export const Services = {
  authentication: authenticationService,
  storage
};
