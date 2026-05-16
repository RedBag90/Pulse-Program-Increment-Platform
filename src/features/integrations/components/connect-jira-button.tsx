"use client";

export function ConnectJiraButton() {
  return (
    <button
      onClick={() => {
        window.location.href = "/api/integrations/jira/connect";
      }}
      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
    >
      Connect Jira
    </button>
  );
}
