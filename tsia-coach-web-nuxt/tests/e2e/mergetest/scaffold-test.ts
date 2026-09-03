import { mergeTests } from '@playwright/test'
import { test as scaffoldSessionTest } from '../fixtures/scaffold-session-fixture'
import { test as rodGridTest } from '../fixtures/rod-grid-fixture'
import { test as quantityJoinTest } from '../fixtures/quantity-join-fixture'
import { test as coachTest } from '../fixtures/coach-fixture'

export const test = mergeTests(scaffoldSessionTest, rodGridTest, quantityJoinTest, coachTest)
export { expect } from '@playwright/test'
