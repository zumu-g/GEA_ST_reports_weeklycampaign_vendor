'use client';

import { useEffect } from 'react';

interface WelcomeTourProps {
  token: string;
}

export default function WelcomeTour({ token }: WelcomeTourProps) {
  useEffect(() => {
    const key = `gea_portal_welcomed_${token}`;
    if (typeof window === 'undefined' || localStorage.getItem(key)) return;

    // Defer to allow DOM to mount
    const timer = setTimeout(async () => {
      // Inject driver.js CSS once
      if (!document.getElementById('driver-css')) {
        const link = document.createElement('link');
        link.id = 'driver-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/driver.js@1/dist/driver.css';
        document.head.appendChild(link);
      }

      const { driver } = await import('driver.js');

      const driverObj = driver({
        showProgress: true,
        animate: true,
        overlayColor: 'rgba(26,24,20,0.5)',
        popoverClass: 'gea-tour-popover',
        steps: [
          {
            popover: {
              title: 'Welcome to your campaign dashboard',
              description: 'This is your private portal. Everything here is updated by your agent: analytics, inspections, and communications.',
              side: 'over',
              align: 'center',
            },
          },
          {
            element: '[data-tour="latest-update"]',
            popover: {
              title: 'Latest update',
              description: 'Your agent posts key campaign news here first.',
              side: 'bottom',
            },
          },
          {
            element: '[data-tour="checklist"]',
            popover: {
              title: 'Campaign checklist',
              description: 'Track campaign milestones as they are completed.',
              side: 'bottom',
            },
          },
          {
            element: '[data-tour="appointments"]',
            popover: {
              title: 'Upcoming appointments',
              description: 'Open homes, photo shoots, and private inspections appear here as they are booked.',
              side: 'bottom',
            },
          },
          {
            element: '[data-tour="analytics"]',
            popover: {
              title: 'Campaign analytics',
              description: 'Live views, enquiries, and saves from realestate.com.au and domain.com.au, updated weekly.',
              side: 'top',
            },
          },
        ],
        onDestroyStarted: () => {
          localStorage.setItem(key, '1');
          driverObj.destroy();
        },
      });

      driverObj.drive();
    }, 800);

    return () => clearTimeout(timer);
  }, [token]);

  return null;
}
