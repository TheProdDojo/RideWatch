import { useMemo } from 'react';
import { APP_CONSTANTS } from '../constants';

export const useVendorUsage = (sessions, vendorProfile = null) => {
    const usage = useMemo(() => {
        if (!sessions) return { activeCount: 0, monthlyCount: 0, canCreate: true };

        // Determine if vendor has Pro-level access
        const isPro = (() => {
            if (!vendorProfile) return false;
            if (vendorProfile.planType === 'pro') return true;
            // Trial: check if still within trial period
            if (vendorProfile.planType === 'trial') {
                return vendorProfile.trialExpiresAt > Date.now();
            }
            return false;
        })();

        // Limits
        const MAX_ACTIVE = APP_CONSTANTS.LIMITS.FREE.MAX_ACTIVE_DELIVERIES;
        const MAX_MONTHLY = APP_CONSTANTS.LIMITS.FREE.MAX_MONTHLY_DELIVERIES;

        // 1. Concurrent Active Sessions
        const activeStatuses = ['active', 'pending', 'en_route_to_pickup', 'picked_up'];
        const activeCount = sessions.filter(s => activeStatuses.includes(s.status)).length;

        // 2. Monthly Total Sessions
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
            isPro,
            limits: {
                maxActive: isPro ? Infinity : MAX_ACTIVE,
                maxMonthly: isPro ? Infinity : MAX_MONTHLY
            }
        };
    }, [sessions, vendorProfile]);

    return usage;
};
