// The ONE place the screens talk to the contract.
// USE_MOCK in config.ts switches between the pretend contract and the real one.
import { USE_MOCK } from "../config";
import * as mock from "./mock";
import * as real from "./real";

const api = USE_MOCK ? mock : real;

export const registerIssuer = api.registerIssuer;
export const issueCredential = api.issueCredential;
export const verify = api.verify;
export const getIssuer = api.getIssuer;
export const openDispute = api.openDispute;
export const vote = api.vote;
export const getDispute = api.getDispute;
export const releaseBond = api.releaseBond;
