import { createFileRoute } from "@tanstack/react-router";
import { RiderSignupForm } from "@/components/rider/RiderSignupForm";

export const Route = createFileRoute("/rider/signup")({
  component: RiderSignupForm,
});
