import { createFileRoute } from "@tanstack/react-router";
import { LinenApp } from "@/components/linen/app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <LinenApp />;
}
