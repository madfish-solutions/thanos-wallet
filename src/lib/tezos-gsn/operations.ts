import { buildQuery } from "./base";
import {
  AvailableTokensResponse,
  PriceQueryParams,
  PriceQueryResponse,
} from "./types";

export const getAvailableTokens = buildQuery<{}, AvailableTokensResponse>(
  "GET",
  "/tokens"
);

export const getTokenPrice = buildQuery<PriceQueryParams, PriceQueryResponse>(
  "GET",
  "/price",
  ["tokenAddress", "tokenId"]
);

export const submitTransaction = buildQuery<{}, any>("POST", "/submit");

export const getAverageTransferGas = buildQuery<{}, number>(
  "GET",
  "/average_transfer_gas"
);

export const getAveragePermitGas = buildQuery<{}, number>(
  "GET",
  "/average_permit_gas"
);
