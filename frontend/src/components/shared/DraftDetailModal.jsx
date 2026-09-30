import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Modal, { ModalFooter } from './Modal';
import StatusBadge from './StatusBadge';

function DetailField({ label, children }) {
  if (!children) return null;
  return (
    <div className="draft-detail-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function VacatureDetail({ draft }) {
  const fd = draft.form_data || {};
  return (
    <dl className="draft-detail-fields">
      <DetailField label="Functietitel">{fd.functietitel || fd.titel}</DetailField>
      <DetailField label="Locatie">{fd.plaats}</DetailField>
      <DetailField label="Uren/week">{fd.uren}</DetailField>
      <DetailField label="Contract">{fd.contract}</DetailField>
      <DetailField label="Salaris">{fd.salaris}</DetailField>
      <DetailField label="Omschrijving (NL)">
        {draft.omschrijving_nl ? (
          <div className="draft-detail-html" dangerouslySetInnerHTML={{ __html: draft.omschrijving_nl }} />
        ) : null}
      </DetailField>
      <DetailField label="Functie-eisen">
        {draft.functie_eisen ? (
          <div className="draft-detail-html" dangerouslySetInnerHTML={{ __html: draft.functie_eisen }} />
        ) : null}
      </DetailField>
      <DetailField label="Wat wij bieden">
        {draft.wat_wij_bieden ? (
          <div className="draft-detail-html" dangerouslySetInnerHTML={{ __html: draft.wat_wij_bieden }} />
        ) : null}
      </DetailField>
      <DetailField label="Social post (NL)">{draft.social_nl}</DetailField>
      {draft.translations && Object.keys(draft.translations).length > 0 ? (
        Object.entries(draft.translations).map(([lang, content]) => (
          <DetailField key={lang} label={`Vertaling (${lang.toUpperCase()})`}>
            {typeof content === 'string' ? content : (
              <div className="draft-detail-html" dangerouslySetInnerHTML={{ __html: content.omschrijving || JSON.stringify(content) }} />
            )}
          </DetailField>
        ))
      ) : null}
    </dl>
  );
}

function MarketingDetail({ draft }) {
  return (
    <dl className="draft-detail-fields">
      <DetailField label="LinkedIn post">{draft.linkedin_post}</DetailField>
      <DetailField label="Instagram caption">{draft.instagram_caption}</DetailField>
      {draft.image_path ? (
        <DetailField label="Afbeelding">
          <img
            src={draft.image_path.startsWith('http') ? draft.image_path : `/uploads/${draft.image_path}`}
            alt="Gegenereerde afbeelding"
            className="draft-detail-image"
          />
        </DetailField>
      ) : null}
    </dl>
  );
}

function BlogDetail({ draft }) {
  return (
    <dl className="draft-detail-fields">
      <DetailField label="Blog titel">{draft.blog_titel}</DetailField>
      <DetailField label="Inhoud">
        {draft.blog_html ? (
          <div className="draft-detail-html" dangerouslySetInnerHTML={{ __html: draft.blog_html }} />
        ) : null}
      </DetailField>
    </dl>
  );
}

function CriticusSection({ draft }) {
  if (draft.criticus_passed === null && !draft.criticus_notes) return null;
  return (
    <div className="draft-detail-criticus">
      <h4>Criticus</h4>
      <p>
        <strong>Resultaat:</strong>{' '}
        {draft.criticus_passed === true ? 'Goedgekeurd' : draft.criticus_passed === false ? 'Afgekeurd' : 'Niet uitgevoerd'}
      </p>
      {draft.criticus_notes ? <p className="draft-detail-criticus-notes">{draft.criticus_notes}</p> : null}
    </div>
  );
}

function getDraftTitle(draft) {
  if (!draft) return 'Concept details';
  const fd = draft.form_data || {};
  return fd.functietitel || fd.onderwerp || fd.title || fd.titel || 'Concept details';
}

export default function DraftDetailModal({ draftId, onClose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['draft-detail', draftId],
    queryFn: () => api(`/drafts/${draftId}`),
    enabled: Boolean(draftId),
  });

  const draft = data?.draft;

  return (
    <Modal
      open={Boolean(draftId)}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={isLoading ? 'Laden...' : getDraftTitle(draft)}
      size="lg"
    >
      {isLoading ? (
        <p>Concept wordt geladen...</p>
      ) : isError ? (
        <p>Kon concept niet laden.</p>
      ) : draft ? (
        <div className="draft-detail-content">
          <div className="draft-detail-meta">
            <StatusBadge status={draft.status} />
            <span className="draft-detail-type">
              {draft.type === 'marketing-post' ? 'Marketing' : draft.type === 'blog' ? 'Blog' : 'Vacature'}
            </span>
          </div>

          {draft.type === 'vacature' && <VacatureDetail draft={draft} />}
          {draft.type === 'marketing-post' && <MarketingDetail draft={draft} />}
          {draft.type === 'blog' && <BlogDetail draft={draft} />}

          <CriticusSection draft={draft} />
        </div>
      ) : null}

      <ModalFooter>
        <button
          type="button"
          className="confirm-btn-cancel"
          onClick={onClose}
          autoFocus
        >
          Sluiten
        </button>
      </ModalFooter>
    </Modal>
  );
}
