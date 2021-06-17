import axios, { AxiosRequestConfig } from "axios";

export const BASE_URL = "http://167.99.133.200:3000";

export const api = axios.create({ baseURL: BASE_URL });

export type TezosGsnRequestParams<T> = T &
  Omit<AxiosRequestConfig, "method" | "url" | "params">;

export function buildQuery<P extends Record<string, unknown>, R = any>(
  method: "GET" | "POST",
  path: ((params: TezosGsnRequestParams<P>) => string) | string,
  toQueryParams?:
    | ((params: TezosGsnRequestParams<P>) => Record<string, unknown>)
    | Array<keyof P>
) {
  return async (params: TezosGsnRequestParams<P>) => {
    const url = typeof path === "function" ? path(params) : path;
    const queryParams =
      typeof toQueryParams === "function"
        ? toQueryParams(params)
        : toQueryParams
        ? pick(params, toQueryParams)
        : undefined;

    const r = await api.request<R>({
      method,
      url,
      params: queryParams,
      ...params,
    });
    return r.data;
  };
}
  
function pick<T, U extends keyof T>(obj: T, keys: U[]) {
  const newObj: Partial<T> = {};
  keys.forEach((key) => {
    if (key in obj) {
      newObj[key] = obj[key];
    }
  });
  return newObj as Pick<T, U>;
}
