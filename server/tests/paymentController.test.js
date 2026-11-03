
jest.mock('../models/Workshop', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../models/WorkshopEnrollment', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../models/Payment', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('../utils/notify', () => ({
  notify: jest.fn(),
}));

const Workshop = require('../models/Workshop');
const WorkshopEnrollment = require('../models/WorkshopEnrollment');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { notify } = require('../utils/notify');
const {
  startPayment,
  paymentSuccess,
  paymentFail,
  paymentCancel,
} = require('../controllers/paymentController');

const seekerId = '507f1f77bcf86cd799439011';
const workshopId = '507f1f77bcf86cd799439012';
const tranId = 'ME1730000000abcd1234';
const FRONTEND = 'http://localhost:5173';

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  process.env.SSLC_STORE_ID = 'test_store';
  process.env.SSLC_STORE_PASSWD = 'test_password';
  process.env.BACKEND_URL = 'http://localhost:5000';
  process.env.FRONTEND_URL = FRONTEND;
  global.fetch = jest.fn();
});

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
}

function expectRedirect(res, path) {
  expect(res.redirect).toHaveBeenCalledWith(303, `${FRONTEND}${path}`);
}

function gatewayReply(data) {
  return { json: async () => data };
}

function makeWorkshop(overrides = {}) {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return {
    _id: workshopId,
    title: 'Managing Exam Stress',
    status: 'Scheduled',
    date,
    price: 500,
    isPaid: true,
    isFull: false,
    ...overrides,
  };
}

function makePayment(overrides = {}) {
  return {
    tranId,
    workshop: workshopId,
    seeker: seekerId,
    amount: 500,
    status: 'pending',
    valId: null,
    paidAt: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('startPayment', () => {
  const makeReq = (overrides = {}) => ({
    params: { id: workshopId },
    user: { id: seekerId, role: 'seeker' },
    body: {},
    ...overrides,
  });

  function setupHappyPath() {
    Workshop.findById.mockResolvedValue(makeWorkshop());
    WorkshopEnrollment.findOne.mockResolvedValue(null);
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ name: 'Test Seeker', email: 'seeker@test.com' }),
    });
    Payment.create.mockImplementation(async (data) => ({
      ...data,
      save: jest.fn().mockResolvedValue(undefined),
    }));
    global.fetch.mockResolvedValue(
      gatewayReply({ status: 'SUCCESS', GatewayPageURL: 'https://sandbox.sslcommerz.com/pay/abc' })
    );
  }

  test('returns 400 for an invalid workshop id', async () => {
    const res = mockRes();
    await startPayment(makeReq({ params: { id: 'nope' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Workshop.findById).not.toHaveBeenCalled();
  });

  test('returns 500 when the gateway is not configured', async () => {
    delete process.env.SSLC_STORE_PASSWD;
    const res = mockRes();
    await startPayment(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(Payment.create).not.toHaveBeenCalled();
  });

  test('returns 404 when the workshop does not exist', async () => {
    Workshop.findById.mockResolvedValue(null);
    const res = mockRes();
    await startPayment(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('refuses a workshop that is not scheduled', async () => {
    Workshop.findById.mockResolvedValue(makeWorkshop({ status: 'Cancelled' }));
    const res = mockRes();
    await startPayment(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Payment.create).not.toHaveBeenCalled();
  });

  test('refuses a workshop whose date has passed', async () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    Workshop.findById.mockResolvedValue(makeWorkshop({ date: past }));
    const res = mockRes();
    await startPayment(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Payment.create).not.toHaveBeenCalled();
  });

  test('refuses a free workshop, it must use Enroll', async () => {
    Workshop.findById.mockResolvedValue(makeWorkshop({ price: 0, isPaid: false }));
    const res = mockRes();
    await startPayment(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'This workshop is free. Use Enroll.' });
    expect(Payment.create).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('refuses a full workshop before taking any payment', async () => {
    Workshop.findById.mockResolvedValue(makeWorkshop({ isFull: true }));
    const res = mockRes();
    await startPayment(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(Payment.create).not.toHaveBeenCalled();
  });

  test('refuses a seeker who is already enrolled', async () => {
    Workshop.findById.mockResolvedValue(makeWorkshop());
    WorkshopEnrollment.findOne.mockResolvedValue({ _id: 'enrollment1' });
    const res = mockRes();
    await startPayment(makeReq(), res);
    expect(WorkshopEnrollment.findOne).toHaveBeenCalledWith({
      workshop: workshopId,
      seeker: seekerId,
      status: 'Enrolled',
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(Payment.create).not.toHaveBeenCalled();
  });

  test('saves a pending payment and returns the gateway url', async () => {
    setupHappyPath();
    const res = mockRes();
    await startPayment(makeReq(), res);
    expect(Payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ workshop: workshopId, seeker: seekerId, amount: 500 })
    );
    expect(res.json).toHaveBeenCalledWith({
      gatewayUrl: 'https://sandbox.sslcommerz.com/pay/abc',
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  test('takes the amount from the workshop, never from the request body', async () => {
    setupHappyPath();
    const body = { amount: 1, price: 1, total_amount: 1 };
    await startPayment(makeReq({ body }), mockRes());
    expect(Payment.create.mock.calls[0][0].amount).toBe(500);
    const sent = global.fetch.mock.calls[0][1].body;
    expect(sent.get('total_amount')).toBe('500.00');
  });

  test('creates a different transaction id for each payment', async () => {
    setupHappyPath();
    await startPayment(makeReq(), mockRes());
    await startPayment(makeReq(), mockRes());
    const first = Payment.create.mock.calls[0][0].tranId;
    const second = Payment.create.mock.calls[1][0].tranId;
    expect(first).toMatch(/^ME\d+[0-9a-f]{8}$/);
    expect(second).not.toBe(first);
  });

  test('sends the callback urls, the currency and the transaction id to the gateway', async () => {
    setupHappyPath();
    await startPayment(makeReq(), mockRes());
    const sent = global.fetch.mock.calls[0][1].body;
    expect(sent.get('success_url')).toBe('http://localhost:5000/api/payments/success');
    expect(sent.get('fail_url')).toBe('http://localhost:5000/api/payments/fail');
    expect(sent.get('cancel_url')).toBe('http://localhost:5000/api/payments/cancel');
    expect(sent.get('currency')).toBe('BDT');
    expect(sent.get('tran_id')).toBe(Payment.create.mock.calls[0][0].tranId);
  });

  test('does not create an enrollment or take a seat yet', async () => {
    setupHappyPath();
    await startPayment(makeReq(), mockRes());
    expect(WorkshopEnrollment.create).not.toHaveBeenCalled();
    expect(Workshop.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('returns 502 and marks the payment failed when the gateway refuses', async () => {
    setupHappyPath();
    global.fetch.mockResolvedValue(
      gatewayReply({ status: 'FAILED', failedreason: 'Store Credential Error' })
    );
    const res = mockRes();
    await startPayment(makeReq(), res);
    const payment = await Payment.create.mock.results[0].value;
    expect(res.status).toHaveBeenCalledWith(502);
    expect(payment.status).toBe('failed');
    expect(payment.save).toHaveBeenCalled();
  });

  test('returns 502 when the gateway cannot be reached', async () => {
    setupHappyPath();
    global.fetch.mockRejectedValue(new Error('network down'));
    const res = mockRes();
    await startPayment(makeReq(), res);
    const payment = await Payment.create.mock.results[0].value;
    expect(res.status).toHaveBeenCalledWith(502);
    expect(payment.status).toBe('failed');
  });

  test('returns 500 when the database fails', async () => {
    Workshop.findById.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await startPayment(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('paymentSuccess', () => {
  const makeReq = (body = { tran_id: tranId, val_id: 'VAL123' }) => ({ body });

  function validReply(overrides = {}) {
    return gatewayReply({
      status: 'VALID',
      tran_id: tranId,
      amount: '500.00',
      currency_type: 'BDT',
      ...overrides,
    });
  }

  test('redirects to the fail page when the request has no body', async () => {
    const res = mockRes();
    await paymentSuccess({}, res);
    expectRedirect(res, '/payment/fail?reason=invalid');
    expect(Payment.findOne).not.toHaveBeenCalled();
  });

  test('redirects to the fail page when val_id is missing', async () => {
    const res = mockRes();
    await paymentSuccess(makeReq({ tran_id: tranId }), res);
    expectRedirect(res, '/payment/fail?reason=invalid');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('redirects to the fail page for a transaction we never created', async () => {
    Payment.findOne.mockResolvedValue(null);
    const res = mockRes();
    await paymentSuccess(makeReq(), res);
    expectRedirect(res, '/payment/fail?reason=invalid');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('a repeated callback shows success without enrolling twice', async () => {
    Payment.findOne.mockResolvedValue(makePayment({ status: 'success' }));
    const res = mockRes();
    await paymentSuccess(makeReq(), res);
    expectRedirect(res, `/payment/success?workshop=${workshopId}`);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(Workshop.findOneAndUpdate).not.toHaveBeenCalled();
    expect(WorkshopEnrollment.create).not.toHaveBeenCalled();
  });

  test.each(['failed', 'cancelled'])('does not revive a payment that is %s', async (status) => {
    const payment = makePayment({ status });
    Payment.findOne.mockResolvedValue(payment);
    const res = mockRes();
    await paymentSuccess(makeReq(), res);
    expectRedirect(res, '/payment/fail?reason=invalid');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(payment.status).toBe(status);
  });

  test('verifies with the gateway using the val_id', async () => {
    Payment.findOne.mockResolvedValue(makePayment());
    global.fetch.mockResolvedValue(validReply({ status: 'FAILED' }));
    await paymentSuccess(makeReq(), mockRes());
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('validationserverAPI.php');
    expect(url).toContain('val_id=VAL123');
  });

  test('rejects a payment the gateway does not confirm', async () => {
    const payment = makePayment();
    Payment.findOne.mockResolvedValue(payment);
    global.fetch.mockResolvedValue(validReply({ status: 'FAILED' }));
    const res = mockRes();
    await paymentSuccess(makeReq(), res);
    expectRedirect(res, '/payment/fail?reason=verify');
    expect(payment.status).toBe('failed');
    expect(payment.save).toHaveBeenCalled();
    expect(WorkshopEnrollment.create).not.toHaveBeenCalled();
  });

  test('rejects a transaction id that does not match', async () => {
    const payment = makePayment();
    Payment.findOne.mockResolvedValue(payment);
    global.fetch.mockResolvedValue(validReply({ tran_id: 'SOMEONE_ELSE' }));
    const res = mockRes();
    await paymentSuccess(makeReq(), res);
    expectRedirect(res, '/payment/fail?reason=verify');
    expect(payment.status).toBe('failed');
  });

  test('rejects an amount that does not match what we saved', async () => {
    const payment = makePayment();
    Payment.findOne.mockResolvedValue(payment);
    global.fetch.mockResolvedValue(validReply({ amount: '1.00' }));
    const res = mockRes();
    await paymentSuccess(makeReq(), res);
    expectRedirect(res, '/payment/fail?reason=verify');
    expect(payment.status).toBe('failed');
    expect(WorkshopEnrollment.create).not.toHaveBeenCalled();
  });

  test('rejects a payment in another currency', async () => {
    const payment = makePayment();
    Payment.findOne.mockResolvedValue(payment);
    global.fetch.mockResolvedValue(validReply({ currency_type: 'USD' }));
    const res = mockRes();
    await paymentSuccess(makeReq(), res);
    expectRedirect(res, '/payment/fail?reason=verify');
    expect(payment.status).toBe('failed');
  });

  test('rejects the payment when the gateway cannot be reached', async () => {
    const payment = makePayment();
    Payment.findOne.mockResolvedValue(payment);
    global.fetch.mockRejectedValue(new Error('network down'));
    const res = mockRes();
    await paymentSuccess(makeReq(), res);
    expectRedirect(res, '/payment/fail?reason=verify');
    expect(payment.status).toBe('failed');
  });

  describe('when the gateway confirms the payment', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue(validReply());
      Workshop.findOneAndUpdate.mockResolvedValue({ title: 'Managing Exam Stress' });
      WorkshopEnrollment.findOneAndUpdate.mockResolvedValue(null);
      WorkshopEnrollment.create.mockResolvedValue({ _id: 'enrollment1' });
    });

    test('takes a seat, creates the enrollment and marks the payment successful', async () => {
      const payment = makePayment();
      Payment.findOne.mockResolvedValue(payment);
      const res = mockRes();

      await paymentSuccess(makeReq(), res);

      expect(Workshop.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(Workshop.findOneAndUpdate.mock.calls[0][0]._id).toBe(workshopId);
      expect(Workshop.findOneAndUpdate.mock.calls[0][1]).toEqual({ $inc: { enrolledCount: 1 } });
      expect(WorkshopEnrollment.create).toHaveBeenCalledWith({
        workshop: workshopId,
        seeker: seekerId,
      });
      expect(payment.status).toBe('success');
      expect(payment.valId).toBe('VAL123');
      expect(payment.paidAt).toBeInstanceOf(Date);
      expect(payment.save).toHaveBeenCalled();
      expectRedirect(res, `/payment/success?workshop=${workshopId}`);
    });

    test('accepts the VALIDATED status as well as VALID', async () => {
      const payment = makePayment();
      Payment.findOne.mockResolvedValue(payment);
      global.fetch.mockResolvedValue(validReply({ status: 'VALIDATED' }));
      await paymentSuccess(makeReq(), mockRes());
      expect(payment.status).toBe('success');
    });

    test('notifies the seeker that they are enrolled', async () => {
      Payment.findOne.mockResolvedValue(makePayment());
      await paymentSuccess(makeReq(), mockRes());
      expect(notify).toHaveBeenCalledWith(
        seekerId,
        'workshop_enrolled',
        expect.stringContaining('Managing Exam Stress'),
        '/dashboard/workshops'
      );
    });

    test('re-activates a cancelled enrollment instead of creating a second one', async () => {
      const payment = makePayment();
      Payment.findOne.mockResolvedValue(payment);
      WorkshopEnrollment.findOneAndUpdate.mockResolvedValue({ _id: 'old-enrollment' });
      await paymentSuccess(makeReq(), mockRes());
      expect(WorkshopEnrollment.create).not.toHaveBeenCalled();
      expect(payment.status).toBe('success');
    });

    test('does not enroll when the workshop filled up while the seeker was paying', async () => {
      const payment = makePayment();
      Payment.findOne.mockResolvedValue(payment);
      Workshop.findOneAndUpdate.mockResolvedValue(null);
      const res = mockRes();

      await paymentSuccess(makeReq(), res);

      expectRedirect(res, '/payment/fail?reason=unavailable');
      expect(WorkshopEnrollment.create).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
      expect(payment.status).toBe('failed');
      expect(payment.valId).toBe('VAL123');
    });

    test('gives the seat back and still succeeds when the seeker is already enrolled', async () => {
      const payment = makePayment();
      Payment.findOne.mockResolvedValue(payment);
      WorkshopEnrollment.create.mockRejectedValue({ code: 11000 });
      const res = mockRes();

      await paymentSuccess(makeReq(), res);

      expect(Workshop.updateOne).toHaveBeenCalledWith(
        { _id: workshopId },
        { $inc: { enrolledCount: -1 } }
      );
      expect(notify).not.toHaveBeenCalled();
      expect(payment.status).toBe('success');
      expectRedirect(res, `/payment/success?workshop=${workshopId}`);
    });

    test('redirects to the fail page on an unexpected error', async () => {
      Payment.findOne.mockResolvedValue(makePayment());
      WorkshopEnrollment.create.mockRejectedValue(new Error('db down'));
      const res = mockRes();
      await paymentSuccess(makeReq(), res);
      expectRedirect(res, '/payment/fail?reason=error');
    });
  });
});

describe('paymentFail', () => {
  test('marks a pending payment as failed and redirects to the fail page', async () => {
    const res = mockRes();
    await paymentFail({ body: { tran_id: tranId } }, res);
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { tranId, status: 'pending' },
      { status: 'failed' }
    );
    expectRedirect(res, '/payment/fail?reason=gateway');
  });

  test('writes nothing and still redirects when there is no transaction id', async () => {
    const res = mockRes();
    await paymentFail({}, res);
    expect(Payment.updateOne).not.toHaveBeenCalled();
    expectRedirect(res, '/payment/fail?reason=gateway');
  });

  test('redirects to the fail page when the database fails', async () => {
    Payment.updateOne.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await paymentFail({ body: { tran_id: tranId } }, res);
    expectRedirect(res, '/payment/fail?reason=error');
  });
});

describe('paymentCancel', () => {
  test('marks a pending payment as cancelled and redirects to the cancel page', async () => {
    const res = mockRes();
    await paymentCancel({ body: { tran_id: tranId } }, res);
    expect(Payment.updateOne).toHaveBeenCalledWith(
      { tranId, status: 'pending' },
      { status: 'cancelled' }
    );
    expectRedirect(res, '/payment/cancel');
  });

  test('writes nothing and still redirects when there is no transaction id', async () => {
    const res = mockRes();
    await paymentCancel({}, res);
    expect(Payment.updateOne).not.toHaveBeenCalled();
    expectRedirect(res, '/payment/cancel');
  });

  test('redirects to the fail page when the database fails', async () => {
    Payment.updateOne.mockRejectedValue(new Error('db down'));
    const res = mockRes();
    await paymentCancel({ body: { tran_id: tranId } }, res);
    expectRedirect(res, '/payment/fail?reason=error');
  });
});