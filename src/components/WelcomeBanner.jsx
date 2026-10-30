const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
}

// Dashboard ke upar salam; children = buttons
export default function WelcomeBanner({ name, subtitle, children }) {
  return (
    <div className="fade-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 p-6 text-white shadow-sm sm:p-8">
      <p className="text-sm text-indigo-200">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
        {greeting()}, {name}
      </h1>
      <p className="mt-1 text-sm text-indigo-100">{subtitle}</p>
      <div className="mt-5 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
