"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ListingCondition } from "@/generated/prisma/enums";

type CreateListingInput = {
  title: string;
  description: string;
  price: string;
  condition: string;
  categoryId: string;
  imageKey: string | null;
};

const PRICE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

export async function createListing(input: CreateListingInput) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const title = input.title.trim();
  const description = input.description.trim();

  if (title.length < 3 || title.length > 100) {
    throw new Error("Title must be between 3 and 100 characters.");
  }
  if (description.length < 10 || description.length > 2000) {
    throw new Error("Description must be between 10 and 2000 characters.");
  }
  if (!PRICE_PATTERN.test(input.price) || Number(input.price) <= 0) {
    throw new Error("Price must be a positive number with up to 2 decimal places.");
  }
  if (!Object.values(ListingCondition).includes(input.condition as ListingCondition)) {
    throw new Error("Invalid condition.");
  }

  const category = await db.category.findUnique({
    where: { id: input.categoryId },
  });
  if (!category) {
    throw new Error("Invalid category.");
  }

  const listing = await db.listing.create({
    data: {
      title,
      description,
      price: input.price,
      condition: input.condition as ListingCondition,
      categoryId: category.id,
      sellerId: session.user.id,
      imageUrl: input.imageKey,
    },
  });

  redirect(`/?created=${listing.id}`);
}
