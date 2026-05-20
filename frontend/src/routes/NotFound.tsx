import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-8">
      <div className="max-w-md text-center">
        <div className="display-serif text-7xl text-ink-50 mb-4">404</div>
        <p className="text-ink-400 mb-8">
          That page doesn't exist. Maybe you meant the inbox or the upload page.
        </p>
        <div className="flex justify-center gap-3">
          <Link to="/">
            <Button variant="secondary">Home</Button>
          </Link>
          <Link to="/inbox">
            <Button>Inbox</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
