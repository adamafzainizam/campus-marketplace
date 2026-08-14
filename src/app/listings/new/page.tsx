import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCategories } from "@/lib/categories";
import { ListingForm } from "./ListingForm";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default async function NewListingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin?callbackUrl=/listings/new");
  }

  const categories = await getCategories();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6 sm:py-12">
      <Breadcrumbs items={[{ label: "Post a listing" }]} />
      <h1 className="mb-6">Post a listing</h1>
      <ListingForm categories={categories} />
    </div>
  );
}
