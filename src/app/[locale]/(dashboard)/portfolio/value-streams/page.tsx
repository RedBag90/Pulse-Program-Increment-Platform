import { redirect } from "next/navigation";

/**
 * Value Stream management has moved into the Capacity Planning module, which
 * now owns the definition of Value Streams, ARTs and Teams. This route stays as
 * a redirect so existing links and bookmarks keep working.
 */
export default function ValueStreamsPage() {
  redirect("/capacity");
}
