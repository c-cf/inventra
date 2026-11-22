import { Suspense } from "react";

import { PageStatus } from "@/components/PageStatus";
import { ProductDetail } from "@/components/ProductDetail";

// The product id is only known at request time, so with Cache Components the
// client component that reads it (via useParams) must sit inside Suspense.
export default function ProductPage() {
  return (
    <Suspense fallback={<PageStatus message="Loading product..." />}>
      <ProductDetail />
    </Suspense>
  );
}
