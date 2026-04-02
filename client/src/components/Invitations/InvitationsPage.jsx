import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listMyInvitations, acceptInvitation, declineInvitation } from '../../services/invitationServices';
import { useUser } from '../../../context/useUser';

import './InvitationsPage.css';

function mongoIdString(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.$oid) return value.$oid;
  return String(value);
}

export default function InvitationsPage() {
  const navigate = useNavigate();
  const { dbUser } = useUser();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    if (!dbUser?._id) {
      setInvitations([]);
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await listMyInvitations(dbUser._id);
      setInvitations(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError('Could not load invitations. Try again later.');
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  }, [dbUser?._id]);

  useEffect(() => {
    load();
  }, [load]);

  const tripLabel = (inv) => {
    const t = inv.tripId;
    if (t && typeof t === 'object' && t.name) return t.name;
    return 'Trip';
  };

  const tripDates = (inv) => {
    const t = inv.tripId;
    if (!t || typeof t !== 'object') return null;
    const start = t.startDate ? new Date(t.startDate).toLocaleDateString() : null;
    const end = t.endDate ? new Date(t.endDate).toLocaleDateString() : null;
    if (start && end) return `${start} – ${end}`;
    return start || end || null;
  };

  const tripIdForNav = (inv) => {
    const t = inv.tripId;
    if (t && typeof t === 'object') return mongoIdString(t._id);
    return mongoIdString(t);
  };

  const handleAccept = async (inv) => {
    const id = mongoIdString(inv._id);
    setActionId(id);
    setError(null);
    try {
      await acceptInvitation(id, dbUser._id);
      const tid = tripIdForNav(inv);
      window.dispatchEvent(new CustomEvent('invitationsChanged'));
      if (tid) {
        navigate(`/view-trip-details/${tid}`);
      } else {
        await load();
      }
    } catch (e) {
      const msg =
        e?.response?.data?.error || e?.message || 'Could not accept the invitation.';
      setError(msg);
    } finally {
      setActionId(null);
    }
  };

  const handleDecline = async (inv) => {
    const id = mongoIdString(inv._id);
    setActionId(id);
    setError(null);
    try {
      await declineInvitation(id, dbUser._id);
      window.dispatchEvent(new CustomEvent('invitationsChanged'));
      setInvitations((prev) => prev.filter((x) => mongoIdString(x._id) !== id));
    } catch (e) {
      const msg =
        e?.response?.data?.error || e?.message || 'Could not decline the invitation.';
      setError(msg);
    } finally {
      setActionId(null);
    }
  };

  if (!dbUser?._id) {
    return (
      <div className="invitations-page">
        <p className="invitations-page__muted">Sign in to see trip invitations.</p>
      </div>
    );
  }

  return (
    <div className="invitations-page">
      <h1>Trip invitations</h1>
      <p className="invitations-page__intro">
        When someone shares a trip with your email, it appears here. Accept to view it in{' '}
        <strong>My Trips</strong>.
      </p>

      {error && <p className="invitations-page__error" role="alert">{error}</p>}

      {loading ? (
        <p className="invitations-page__muted">Loading…</p>
      ) : invitations.length === 0 ? (
        <p className="invitations-page__empty">No pending invitations.</p>
      ) : (
        <ul className="invitations-list">
          {invitations.map((inv) => {
            const id = mongoIdString(inv._id);
            const busy = actionId === id;
            return (
              <li key={id} className="invitations-list__item">
                <div className="invitations-list__main">
                  <h2 className="invitations-list__title">{tripLabel(inv)}</h2>
                  {tripDates(inv) && (
                    <p className="invitations-list__meta">{tripDates(inv)}</p>
                  )}
                  {inv.createdAt && (
                    <p className="invitations-list__sent">
                      Invited {new Date(inv.createdAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="invitations-list__actions">
                  <button
                    type="button"
                    className="invitations-list__btn invitations-list__btn--primary"
                    disabled={busy}
                    onClick={() => handleAccept(inv)}
                  >
                    {busy ? '…' : 'Accept'}
                  </button>
                  <button
                    type="button"
                    className="invitations-list__btn invitations-list__btn--ghost"
                    disabled={busy}
                    onClick={() => handleDecline(inv)}
                  >
                    Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
