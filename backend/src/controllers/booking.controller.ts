import type { RequestHandler, Request } from "express";
import * as bookings from "../services/booking.service.js";
function customerId(request: Request) {
  if (!request.user) throw new bookings.BookingError("Authentication is required.", 401);
  return request.user.userId;
}
export const create: RequestHandler = async (req, res, next) => {
  try { const booking = await bookings.createBooking(customerId(req), bookings.validateBooking(req.body)); res.status(201).json({ success: true, message: "Booking requested successfully", data: { booking } }); } catch (error) { next(error); }
};
export const list: RequestHandler = async (req, res, next) => {
  try { res.json({ success: true, data: { bookings: await bookings.myBookings(customerId(req), bookings.validateStatus(req.query.status)) } }); } catch (error) { next(error); }
};
export const details: RequestHandler = async (req, res, next) => {
  try { res.json({ success: true, data: { booking: await bookings.bookingDetails(customerId(req), req.params.bookingNumber) } }); } catch (error) { next(error); }
};
export const cancel: RequestHandler = async (req, res, next) => {
  try { const booking = await bookings.cancelBooking(customerId(req), req.params.bookingNumber); res.json({ success: true, message: "Booking cancelled successfully", data: { booking } }); } catch (error) { next(error); }
};
