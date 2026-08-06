import { createFileRoute } from "@tanstack/react-router";
import { ShopSignupForm } from "@/components/shop/ShopSignupForm";

export const Route = createFileRoute("/sweet/signup")({
  component: ShopSignupForm,
});
