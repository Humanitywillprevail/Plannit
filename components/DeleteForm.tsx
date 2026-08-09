"use client";

export default function DeleteForm({
  action,
  hiddenFields,
  confirmMessage,
  label = "삭제",
  className = "shrink-0 text-xs text-red-500 hover:underline",
}: {
  action: (formData: FormData) => Promise<void>;
  hiddenFields: Record<string, string | number>;
  confirmMessage: string;
  label?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {Object.entries(hiddenFields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
