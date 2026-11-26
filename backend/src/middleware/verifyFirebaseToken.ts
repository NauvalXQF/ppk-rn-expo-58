import type { RequestHandler } from 'express';
import type { FirebaseIdentityAdapter } from '../config/firebaseAdmin.ts';
import { HttpError } from './errorHandler.ts';

export interface AuthenticatedUser {
  uid: string;
  role: 'praktikan' | 'asprak' | 'aslab';
  managedCourseIds: string[];
  assignedLabIds: string[];
}

function scopeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

export function verifyFirebaseToken(identity: FirebaseIdentityAdapter): RequestHandler {
  return async (req, res, next) => {
    const authorization = req.headersDistinct.authorization;
    const token = authorization?.length === 1
      ? /^Bearer +([\w-]+\.[\w-]+\.[\w-]+)$/i.exec(authorization[0])?.[1]
      : undefined;
    if (!token) throw new HttpError('UNAUTHENTICATED');

    const verified = await identity.verifyIdToken(token);
    if (!verified?.uid || verified.uid.includes('/')) throw new HttpError('UNAUTHENTICATED');

    const profile = await identity.readUserProfile(verified.uid);
    if (typeof profile !== 'object' || profile === null || !('role' in profile)
      || !('uid' in profile) || profile.uid !== verified.uid) {
      throw new HttpError('FORBIDDEN');
    }

    const role = profile.role === 'asisten' ? 'asprak' : profile.role;
    if (role !== 'praktikan' && role !== 'asprak' && role !== 'aslab') {
      throw new HttpError('FORBIDDEN');
    }

    const user: AuthenticatedUser = {
      uid: verified.uid,
      role,
      managedCourseIds: role === 'aslab' && 'managedCourseIds' in profile
        ? scopeIds(profile.managedCourseIds) : [],
      assignedLabIds: role === 'asprak' && 'assignedLabIds' in profile
        ? scopeIds(profile.assignedLabIds) : [],
    };
    res.locals.auth = user;
    next();
  };
}
