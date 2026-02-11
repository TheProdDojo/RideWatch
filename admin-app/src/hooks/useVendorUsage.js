import { useMemo } from 'react';

export const useVendorUsage = (sessions, isPro = false) => {
    // Limits
    const MAX_ACTIVE = 5;
    const MAX_MONTHLY = 30;

    const usage = useMemo(() => {
        if (!sessions) return { active: 0, monthly: 0, canCreate: true };

        // 1. Concurrent Active Sessions
        // Statuses that count as "active" for the limit
        const activeStatuses = ['active', 'pending', 'en_route_to_pickup', 'picked_up'];
        const activeCount = sessions.filter(s => activeStatuses.includes(s.status)).length;

        // 2. Monthly Total Sessions
        // Count sessions created in the current calendar month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        const monthlyCount = sessions.filter(s => {
            const createdAt = new Date(s.createdAt).getTime();
            return createdAt >= startOfMonth;
        }).length;

        // 3. Check Limits
        const activeLimitReached = !isPro && activeCount >= MAX_ACTIVE;
        const monthlyLimitReached = !isPro && monthlyCount >= MAX_MONTHLY;
        const canCreate = !activeLimitReached && !monthlyLimitReached;

        return {
            activeCount,
            monthlyCount,
            activeLimitReached,
            monthlyLimitReached,
            canCreate,
            limits: {
                maxActive: isPro ? Infinity : MAX_ACTIVE,
                maxMonthly: isPro ? Infinity : MAX_MONTHLY
            }
        };
    }, [sessions, isPro]);

    return usage;
};
