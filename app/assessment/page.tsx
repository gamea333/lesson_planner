import { redirect } from "next/navigation";

/** Legacy URL — Assessment was renamed to Practice Sheet */
export default function AssessmentRedirect() {
  redirect("/practice-sheet");
}
