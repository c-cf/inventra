import { Suspense } from "react";

import { OrderDetail } from "@/components/OrderDetail";
import { PageStatus } from "@/components/PageStatus";

// The order id is only known at request time, so with Cache Components the
// client component that reads it (via useParams) must sit inside Suspense.
export default function OrderPage() {
  return (
    <Suspense fallback={<PageStatus message="Loading order..." />}>
      <OrderDetail />
    </Suspense>
  );
}
