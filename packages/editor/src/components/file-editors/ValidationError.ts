export type ValidationError = {
  level: 'fatal' | 'warning';
  line?: number;
  message: string;
};
