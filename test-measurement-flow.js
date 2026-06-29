#!/usr/bin/env node

/**
 * Test script to validate end-to-end measurement and order creation flow
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMeasurementAndOrderFlow() {
  console.log('🔍 Testing end-to-end measurement and order flow...\n');

  try {
    // 1. Test if API is running
    console.log('1. Checking API server...');
    const response = await fetch('http://localhost:4000/api/health');
    if (response.ok) {
      console.log('✅ API server is running');
    } else {
      console.log('❌ API server not responding');
      return;
    }

    // 2. Check existing measurement schema
    console.log('\n2. Checking measurement table schema...');
    try {
      const measurements = await prisma.$queryRaw`
        SHOW COLUMNS FROM measurements
      `;
      console.log('Measurements columns:', measurements.map((col: any) => col.Field));
    } catch (error) {
      console.error('Error checking measurement schema:', error);
    }

    // 3. Check existing order_items schema and delivery_status
    console.log('\n3. Checking order_items table schema...');
    try {
      const orderItems = await prisma.$queryRaw`
        SHOW COLUMNS FROM order_items
      `;
      console.log('Order items columns:', orderItems.map((col: any) => col.Field));

      // Check if delivery_status column exists
      const hasDeliveryStatus = orderItems.some((col: any) => col.Field === 'delivery_status');
      console.log('Has delivery_status column:', hasDeliveryStatus);
    } catch (error) {
      console.error('Error checking order_items schema:', error);
    }

    // 4. Test measurement creation endpoint (simulate large payload)
    console.log('\n4. Testing measurement creation with large payload...');
    const measurementPayload = {
      customerId: 'test-customer-id',
      measurementDate: '2026-06-29',
      items: [
        {
          productType: 'Shirt',
          featureLabel: 'Formal',
          values: {
            chest: '42',
            shoulder: '18',
            sleeve: '24',
            waist: '38',
            length: '32',
          },
          customMeasurements: [
            { label: 'Custom 1', value: 10 },
            { label: 'Custom 2', value: 15 }
          ],
          photos: Array(50).fill('base64-encoded-photo-placeholder').join(',') // Large payload
        }
      ]
    };

    try {
      const measurementResponse = await fetch('http://localhost:4000/api/measurements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(measurementPayload)
      });

      if (measurementResponse.status === 201) {
        console.log('✅ Measurement creation successful');
      } else {
        console.log('❌ Measurement creation failed:', measurementResponse.status);
        const text = await measurementResponse.text();
        console.log('Error response:', text);
      }
    } catch (error) {
      console.log('❌ Measurement creation error:', error.message);
    }

    // 5. Test order creation with measurement reference
    console.log('\n5. Testing order creation with measurement reference...');
    const orderPayload = {
      customerId: 'test-customer-id',
      customerName: 'Test Customer',
      customerMobile: '1234567890',
      items: [
        {
          productType: 'Shirt',
          featureLabel: 'Formal',
          quantity: 1,
          price: 2500,
          measurementId: 'existing-measurement-id', // This should exist in DB
          measurementValues: {
            chest: '42"',
            shoulder: '18"',
          }
        }
      ]
    };

    try {
      const orderResponse = await fetch('http://localhost:4000/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify(orderPayload)
      });

      if (orderResponse.status === 201) {
        console.log('✅ Order creation successful');
      } else {
        console.log('❌ Order creation failed:', orderResponse.status);
        const text = await orderResponse.text();
        console.log('Error response:', text);
      }
    } catch (error) {
      console.log('❌ Order creation error:', error.message);
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testMeasurementAndOrderFlow().catch(console.error);