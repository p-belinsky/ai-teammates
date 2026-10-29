import { PricingTable } from "@clerk/nextjs"

// Reached from the upgrade toast, so it is not linked from the sidebar
export default function PricingPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <h1 className="text-center text-2xl font-semibold">Pricing</h1>
        <p className='text-center text-sm'>Bots and their sandboxes are part of the paid plan.</p>
        <PricingTable />
      </div>
    </main>
  )
}
