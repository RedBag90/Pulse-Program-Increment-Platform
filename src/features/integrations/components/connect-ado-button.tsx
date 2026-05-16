"use client";

export function ConnectAdoButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = "/api/integrations/azure-devops/connect";
      }}
      className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors"
    >
      Connect Azure DevOps
    </button>
  );
}
