import { defineEndpoint } from '../http/endpoint';
import {
  RoomCommandSchema,
  RoomEventSchema,
  RoomMapSchema,
  RoomTicketSchema,
} from './chat-room.schema';

/** New realtime room; no equivalent endpoint exists in the HTML mockup. */
export const chatRoomEndpoints = {
  map: defineEndpoint({
    method: 'get',
    path: '/api/v1/chat-room/map',
    response: RoomMapSchema,
  }),
  ticket: defineEndpoint({
    method: 'post',
    path: '/api/v1/chat-room/tickets',
    response: RoomTicketSchema,
  }),
};

export const chatRoomSocket = {
  path: '/api/v1/chat-room/socket',
  request: RoomCommandSchema,
  response: RoomEventSchema,
} as const;
