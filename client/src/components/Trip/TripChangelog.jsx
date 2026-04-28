import React from 'react';

function mongoIdString(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value.$oid) return value.$oid;
    return String(value);
}

function formatChangelogTime(value) {
    const date = new Date(value?.$date || value);
    if (isNaN(date.getTime())) return 'Unknown time';
    return date.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export default function TripChangelog({ changelog = [], loading = false, error = '' }) {
    return (
        <div className="td-tab-content">
            <div className="td-content-header"><h2>Changelog</h2></div>

            {loading && <p className="td-changelog-muted">Loading edit history...</p>}
            {error && <p className="td-invite-error" role="alert">{error}</p>}

            {!loading && !error && changelog.length === 0 && (
                <div className="td-empty-state">
                    <span className="td-empty-icon">◷</span>
                    <p>No edit history yet.</p>
                </div>
            )}

            {!loading && !error && changelog.length > 0 && (
                <ol className="td-changelog-list">
                    {changelog.map((entry) => (
                        <li key={mongoIdString(entry._id) || `${entry.changedAt}-${entry.summary}`} className="td-changelog-item">
                            <div className="td-changelog-marker" aria-hidden="true" />
                            <div className="td-changelog-card">
                                <div className="td-changelog-card-header">
                                    <h3>{entry.summary || 'Trip updated'}</h3>
                                    <time dateTime={entry.changedAt}>{formatChangelogTime(entry.changedAt)}</time>
                                </div>
                                <p className="td-changelog-actor">
                                    Changed by {entry.changedByName || entry.changedBy || 'Unknown user'}
                                </p>
                                {Array.isArray(entry.changes) && entry.changes.length > 0 && (
                                    <ul className="td-changelog-change-list">
                                        {entry.changes.map((change, index) => (
                                            <li key={`${change.field}-${index}`} className="td-changelog-change">
                                                <span className="td-changelog-field">{change.label || change.field}</span>
                                                <span className="td-changelog-value">{change.previousValue || 'blank'}</span>
                                                <span className="td-changelog-arrow">→</span>
                                                <span className="td-changelog-value td-changelog-value--new">{change.newValue || 'blank'}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </div>
    );
}
