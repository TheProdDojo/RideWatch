import { useState } from 'react';
import { Link } from 'react-router-dom';

const TABS = [
    { id: 'vendor', label: '🏪 Vendors', color: 'green' },
    { id: 'rider', label: '🛵 Riders', color: 'blue' },
    { id: 'customer', label: '👤 Customers', color: 'purple' },
];

function StepCard({ number, emoji, title, description, note }) {
    return (
        <div className="flex gap-4 group">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-sm font-bold text-slate-300 group-hover:border-green-500 group-hover:text-green-400 transition">
                {number}
            </div>
            <div className="flex-1 pb-6">
                <h4 className="text-white font-semibold text-base mb-1">
                    {emoji && <span className="mr-2">{emoji}</span>}{title}
                </h4>
                <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
                {note && (
                    <div className="mt-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2">
                        💡 {note}
                    </div>
                )}
            </div>
        </div>
    );
}

function CommandCard({ command, description, example }) {
    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-green-500/30 transition">
            <div className="text-green-400 font-mono text-sm font-semibold mb-1">"{command}"</div>
            <p className="text-slate-400 text-sm">{description}</p>
            {example && (
                <div className="mt-2 text-xs text-slate-500 bg-slate-900/50 rounded-lg px-3 py-2 font-mono">
                    {example}
                </div>
            )}
        </div>
    );
}

function FlowDiagram({ steps }) {
    return (
        <div className="flex flex-col items-center gap-0 my-6">
            {steps.map((step, i) => (
                <div key={i} className="flex flex-col items-center">
                    <div className="bg-slate-800 border border-slate-600 rounded-xl px-5 py-3 text-center min-w-[200px] max-w-[280px]">
                        <span className="text-lg">{step.emoji}</span>
                        <div className="text-white text-sm font-medium mt-1">{step.label}</div>
                        {step.sub && <div className="text-slate-500 text-xs mt-0.5">{step.sub}</div>}
                    </div>
                    {i < steps.length - 1 && (
                        <div className="text-slate-600 text-lg leading-none py-1">↓</div>
                    )}
                </div>
            ))}
        </div>
    );
}

function VendorGuide() {
    return (
        <div className="space-y-8">
            {/* Getting Started */}
            <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center text-green-400">1</span>
                    Getting Started
                </h3>
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-6 space-y-1">
                    <StepCard
                        number="1"
                        emoji="📱"
                        title="Save the RideWatch bot number"
                        description="Add our WhatsApp business number to your contacts. You'll find it in your vendor dashboard under Settings → WhatsApp."
                    />
                    <StepCard
                        number="2"
                        emoji="👋"
                        title='Send "hi" to get your link code'
                        description="Open WhatsApp and send 'hi' to the bot. You'll receive a unique 6-character code (e.g., X7K4NB)."
                        note="Codes expire after 30 minutes. Send 'hi' again to get a new one."
                    />
                    <StepCard
                        number="3"
                        emoji="🔗"
                        title="Link your account"
                        description="Go to your Vendor Dashboard → Settings → WhatsApp tab. Enter the code and click 'Link'. You'll see a ✅ Connected status when done."
                    />
                    <StepCard
                        number="4"
                        emoji="🎉"
                        title="Start using commands!"
                        description='Send "menu" to see all available options, or simply type a command like "new delivery".'
                    />
                </div>
            </section>

            {/* Commands */}
            <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center text-green-400">2</span>
                    Available Commands
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                    <CommandCard command="menu" description="Show the main menu with quick-action buttons" />
                    <CommandCard command="new delivery" description="Start creating a delivery — the bot will ask for customer details" example='Example: "new delivery to Lekki for Chidi, 08012345678"' />
                    <CommandCard command="status" description="Check the status of your active deliveries" />
                    <CommandCard command="summary" description="Get today's delivery stats and performance overview" />
                    <CommandCard command="riders" description="View your list of riders and their stats" />
                    <CommandCard command="cancel" description="Cancel an active delivery" />
                    <CommandCard command="help" description="See the full list of available commands" />
                </div>
            </section>

            {/* Delivery Flow */}
            <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center text-green-400">3</span>
                    Delivery Flow
                </h3>
                <FlowDiagram steps={[
                    { emoji: '📦', label: 'Create Delivery', sub: '"new delivery" command' },
                    { emoji: '🛵', label: 'Assign Rider', sub: 'Pick from your rider list' },
                    { emoji: '📱', label: 'Rider Notified', sub: 'Gets WhatsApp with Accept/Decline' },
                    { emoji: '📤', label: 'Rider Picks Up', sub: 'Customer gets notified' },
                    { emoji: '🚚', label: 'In Transit', sub: 'Live tracking available' },
                    { emoji: '📍', label: 'Rider Arrives', sub: 'Customer gets arrival alert' },
                    { emoji: '✅', label: 'Delivery Complete', sub: 'Stop code verified' },
                ]} />
                <div className="text-center text-sm text-slate-500">
                    You'll receive WhatsApp notifications at every stage.
                </div>
            </section>

            {/* Notifications */}
            <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center text-green-400">4</span>
                    Notifications You'll Receive
                </h3>
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-5">
                    <ul className="space-y-3 text-sm text-slate-300">
                        <li className="flex items-start gap-3">
                            <span className="text-green-400 mt-0.5">✓</span>
                            <span><b className="text-white">Rider accepted</b> — when your rider confirms the delivery</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-green-400 mt-0.5">✓</span>
                            <span><b className="text-white">Rider declined</b> — so you can reassign quickly</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-green-400 mt-0.5">✓</span>
                            <span><b className="text-white">Status updates</b> — picked up, in transit, arrived</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-green-400 mt-0.5">✓</span>
                            <span><b className="text-white">Delivery complete</b> — with stop code verification</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="text-amber-400 mt-0.5">⚠️</span>
                            <span><b className="text-white">Customer issues</b> — if a customer reports a problem</span>
                        </li>
                    </ul>
                </div>
            </section>
        </div>
    );
}

function RiderGuide() {
    return (
        <div className="space-y-8">
            <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">1</span>
                    How It Works
                </h3>
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-6 space-y-1">
                    <StepCard
                        number="1"
                        emoji="📋"
                        title="Your vendor adds your phone number"
                        description="Your vendor registers you in the RideWatch system with your WhatsApp number. No setup required on your end!"
                        note="Make sure your vendor has your correct WhatsApp number."
                    />
                    <StepCard
                        number="2"
                        emoji="📦"
                        title="Receive delivery assignments"
                        description="When a vendor assigns you a delivery, you'll get a WhatsApp message with all the details: customer name, address, and a Google Maps link."
                    />
                    <StepCard
                        number="3"
                        emoji="✅"
                        title="Accept or Decline"
                        description="Tap 'Accept' to confirm the delivery or 'Decline' if you can't take it. The vendor will be notified immediately."
                    />
                    <StepCard
                        number="4"
                        emoji="📤"
                        title="Update your status as you go"
                        description="Tap the status buttons as you progress: Picked Up → In Transit → Arrived. The customer and vendor get updates in real-time."
                    />
                    <StepCard
                        number="5"
                        emoji="🔑"
                        title="Enter the stop code to complete"
                        description="When you arrive, ask the customer for their 4-digit stop code. Type it in WhatsApp to mark the delivery as complete."
                        note="You have 5 attempts. After that, stop code entry is locked for 15 minutes."
                    />
                </div>
            </section>

            {/* Status Flow */}
            <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">2</span>
                    Your Delivery Flow
                </h3>
                <FlowDiagram steps={[
                    { emoji: '📩', label: 'New Assignment', sub: 'Accept or Decline' },
                    { emoji: '📤', label: 'Picked Up', sub: 'Tap button when you collect the package' },
                    { emoji: '🚚', label: 'In Transit', sub: 'On your way to the customer' },
                    { emoji: '📍', label: 'Arrived', sub: 'At the delivery location' },
                    { emoji: '🔑', label: 'Enter Stop Code', sub: 'Customer gives you a 4-digit code' },
                    { emoji: '🎉', label: 'Complete!', sub: 'Delivery logged, stats updated' },
                ]} />
            </section>

            {/* Quick Tips */}
            <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">3</span>
                    Quick Reference
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                    <CommandCard command="menu" description="See your active deliveries" />
                    <CommandCard command="help" description="View all available commands" />
                </div>
                <div className="mt-4 bg-slate-800/30 border border-slate-700 rounded-2xl p-5">
                    <h4 className="text-white font-semibold text-sm mb-3">📍 Navigation</h4>
                    <p className="text-slate-400 text-sm">
                        Every assignment includes a Google Maps link. Tap it to get turn-by-turn navigation to the delivery address.
                    </p>
                </div>
            </section>
        </div>
    );
}

function CustomerGuide() {
    return (
        <div className="space-y-8">
            <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-400">1</span>
                    Automatic Updates
                </h3>
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-6">
                    <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                        When a vendor creates a delivery for you, you'll automatically receive WhatsApp notifications at every stage — <b className="text-white">no setup required</b>.
                    </p>
                    <div className="space-y-4">
                        {[
                            { emoji: '📋', status: 'Rider Assigned', desc: 'A rider has been assigned to deliver your package' },
                            { emoji: '✅', status: 'Rider Accepted', desc: 'Your rider confirmed and is heading to pick up' },
                            { emoji: '📤', status: 'Picked Up', desc: 'Your package has been collected' },
                            { emoji: '🚚', status: 'In Transit', desc: "The rider is on their way to you" },
                            { emoji: '📍', status: 'Arrived', desc: 'Your rider is at your location!' },
                        ].map((item, i) => (
                            <div key={i} className="flex items-start gap-3 bg-slate-800/50 rounded-xl p-3">
                                <span className="text-xl">{item.emoji}</span>
                                <div>
                                    <div className="text-white text-sm font-semibold">{item.status}</div>
                                    <div className="text-slate-400 text-xs">{item.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-400">2</span>
                    When Your Rider Arrives
                </h3>
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-6 space-y-1">
                    <StepCard
                        number="1"
                        emoji="📍"
                        title="You'll get an 'Arrived' notification"
                        description="When the rider reaches your location, you'll receive a message with two buttons."
                    />
                    <StepCard
                        number="2"
                        emoji="✅"
                        title='Tap "Yes, Received" to confirm'
                        description="This marks the delivery as complete. The rider and vendor are notified."
                    />
                    <StepCard
                        number="3"
                        emoji="⭐"
                        title="Rate your experience"
                        description="After confirming, you'll be asked to rate the delivery (⭐ to ⭐⭐⭐⭐⭐). Your ratings help vendors ensure quality service."
                    />
                </div>
            </section>

            <section>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-400">3</span>
                    Need Help?
                </h3>
                <div className="bg-slate-800/30 border border-slate-700 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                        <span className="text-xl">💬</span>
                        <div>
                            <h4 className="text-white font-semibold text-sm">Check your delivery status</h4>
                            <p className="text-slate-400 text-sm">Send any message to the bot — it will show your active deliveries with tracking links.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <h4 className="text-white font-semibold text-sm">Report an issue</h4>
                            <p className="text-slate-400 text-sm">If something goes wrong, tap "Issue" when your rider arrives. The vendor will be immediately notified.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <span className="text-xl">🔗</span>
                        <div>
                            <h4 className="text-white font-semibold text-sm">Tracking link</h4>
                            <p className="text-slate-400 text-sm">Every notification includes a live tracking link you can share with anyone.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default function WhatsAppGuide() {
    const [activeTab, setActiveTab] = useState('vendor');

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <Link to="/vendor" className="flex items-center gap-2 group">
                        <span className="text-xl font-bold text-white">
                            <span className="text-green-400">Ride</span>Watch
                        </span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <a
                            href="https://wa.me/YOUR_BOT_NUMBER"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition"
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Open Bot
                        </a>
                    </div>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* Hero */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm mb-4">
                        <span>💬</span> WhatsApp Integration
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                        WhatsApp User Guide
                    </h1>
                    <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
                        Manage deliveries, track riders, and get real-time updates — all from WhatsApp.
                        Choose your role below to get started.
                    </p>
                </div>

                {/* Tab Selector */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                    ? tab.color === 'green'
                                        ? 'bg-green-500/15 border-green-500/40 text-green-400 border'
                                        : tab.color === 'blue'
                                            ? 'bg-blue-500/15 border-blue-500/40 text-blue-400 border'
                                            : 'bg-purple-500/15 border-purple-500/40 text-purple-400 border'
                                    : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="transition-opacity duration-200">
                    {activeTab === 'vendor' && <VendorGuide />}
                    {activeTab === 'rider' && <RiderGuide />}
                    {activeTab === 'customer' && <CustomerGuide />}
                </div>

                {/* FAQ */}
                <section className="mt-12 border-t border-slate-800 pt-10">
                    <h2 className="text-2xl font-bold text-white mb-6 text-center">
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-4 max-w-2xl mx-auto">
                        {[
                            {
                                q: 'Is WhatsApp the only way to use RideWatch?',
                                a: 'No! WhatsApp is optional. You can always use the web dashboard at ridewatchapp.com. WhatsApp is designed for quick actions on the go.',
                            },
                            {
                                q: 'What if my rider doesn\'t have WhatsApp?',
                                a: 'Riders without WhatsApp can still be assigned deliveries through the web dashboard. They just won\'t get automatic WhatsApp notifications.',
                            },
                            {
                                q: 'Can customers opt out of WhatsApp notifications?',
                                a: 'Customers only receive notifications if a delivery is created with their WhatsApp-registered phone number. They can block the bot number at any time.',
                            },
                            {
                                q: 'What happens if I send a photo or voice note?',
                                a: 'The bot will acknowledge it but can\'t process media yet. It\'ll suggest text-based commands you can use instead.',
                            },
                            {
                                q: 'Is my data secure?',
                                a: 'Yes. All communications are end-to-end encrypted by WhatsApp. Your vendor data is stored securely in Firebase with strict access rules.',
                            },
                            {
                                q: 'My link code expired, what do I do?',
                                a: 'Simply send "hi" to the bot again to get a new code. Codes expire after 30 minutes for security.',
                            },
                        ].map((faq, i) => (
                            <details
                                key={i}
                                className="group bg-slate-800/30 border border-slate-700 rounded-xl overflow-hidden"
                            >
                                <summary className="flex items-center justify-between cursor-pointer px-5 py-4 text-white text-sm font-medium list-none select-none hover:bg-slate-800/50 transition">
                                    <span>{faq.q}</span>
                                    <svg
                                        className="w-5 h-5 text-slate-500 group-open:rotate-180 transition-transform flex-shrink-0 ml-2"
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </summary>
                                <div className="px-5 pb-4 text-slate-400 text-sm leading-relaxed border-t border-slate-700/50">
                                    <p className="pt-3">{faq.a}</p>
                                </div>
                            </details>
                        ))}
                    </div>
                </section>

                {/* Footer CTA */}
                <div className="mt-12 text-center pb-8">
                    <div className="bg-gradient-to-r from-green-900/20 via-green-800/20 to-green-900/20 border border-green-500/20 rounded-2xl p-8">
                        <h3 className="text-xl font-bold text-white mb-2">Ready to get started?</h3>
                        <p className="text-slate-400 text-sm mb-5">Create your vendor account and link WhatsApp in under 2 minutes.</p>
                        <div className="flex items-center justify-center gap-3 flex-wrap">
                            <Link
                                to="/vendor/signup"
                                className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition text-sm"
                            >
                                Create Vendor Account
                            </Link>
                            <Link
                                to="/vendor/login"
                                className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition text-sm"
                            >
                                Sign In
                            </Link>
                        </div>
                    </div>
                    <p className="mt-6 text-xs text-slate-600">
                        A product of{' '}
                        <a href="https://deproductdojo.com" target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-400">
                            The Product Dojo
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
