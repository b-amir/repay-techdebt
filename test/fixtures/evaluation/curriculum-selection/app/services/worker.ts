import { dataQuery } from "../data/query.js";
export function runWorker() {
  return dataQuery("allowed");
}
