import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="py-16 text-center text-sm text-slate-600">
      Page not found.{" "}
      <Link to="/" className="font-medium text-slate-900 underline">
        Go to Process
      </Link>
    </div>
  );
}
