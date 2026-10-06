import { CategoryCards } from "./services/category-cards";
import { CustomerNav } from "@/app/customer-nav";

export default function Home() {


  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap gap-4 justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">
            WorkerBooking
          </h1>

          <CustomerNav />
        </div>
      </header>

      {/* Hero */}
      <section className="bg-blue-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <p className="mb-3">📍 Select your location</p>

          <h2 className="text-4xl font-bold mb-4">
            Find Trusted Workers Near You
          </h2>

          <p className="text-lg mb-8">
            Book skilled professionals for your home and vehicle services.
          </p>

          <div className="max-w-xl mx-auto flex bg-white rounded-xl overflow-hidden">
            <input
              type="text"
              placeholder="What service do you need?"
              className="flex-1 px-5 py-4 text-gray-800 outline-none"
            />

            <button className="bg-gray-900 px-6">
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Our Services
        </h2>

        <CategoryCards />
      </section>

      {/* How it works */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            How It Works
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="border rounded-xl p-6">
              <div className="text-3xl mb-3">🔍</div>
              <h3 className="font-bold text-lg text-gray-900">
                1. Find a Service
              </h3>
              <p className="text-gray-600 mt-2">
                Select the service you need.
              </p>
            </div>

            <div className="border rounded-xl p-6">
              <div className="text-3xl mb-3">👷</div>
              <h3 className="font-bold text-lg text-gray-900">
                2. Choose a Worker
              </h3>
              <p className="text-gray-600 mt-2">
                Compare available workers and their profiles.
              </p>
            </div>

            <div className="border rounded-xl p-6">
              <div className="text-3xl mb-3">📅</div>
              <h3 className="font-bold text-lg text-gray-900">
                3. Book Service
              </h3>
              <p className="text-gray-600 mt-2">
                Select your preferred date and time.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
