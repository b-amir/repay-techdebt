import { listRecords } from "../features/records/list.js";
export function loader() {
  return listRecords("allowed");
}
