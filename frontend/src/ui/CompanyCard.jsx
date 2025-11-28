import Card from './Card'
import Badge from './Badge'
import Button from './Button'

const PLACEHOLDER_IMAGE = 'https://placehold.co/320x160?text=K-Statra'

export default function CompanyCard({ company, onDetails, onRequestPayment }) {
  const c = company || {}
  const hasImg = Array.isArray(c.images) && c.images.length > 0
  const heroImage = hasImg ? c.images[0] : { url: PLACEHOLDER_IMAGE, alt: 'K-Statra default image' }
  return (
    <Card>
      <img
        src={heroImage.url}
        alt={heroImage.alt || c.name || 'K-Statra company image'}
        style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }}
        loading="lazy"
      />
      <div className="row space">
        <div>
          <strong>{c.name}</strong>
          <div className="muted small">{c.industry}</div>
        </div>
      </div>
      <div className="row gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
        {(c.tags || []).slice(0, 4).map((t) => (
          <Badge key={t} tone="primary">
            {t}
          </Badge>
        ))}
      </div>
      {(onDetails || onRequestPayment || c.videoUrl) && (
        <div className="row gap-4 mt-3" style={{ flexWrap: 'wrap' }}>
          {onDetails && (
            <Button variant="secondary" onClick={onDetails}>
              상세
            </Button>
          )}
          {onRequestPayment && <Button onClick={onRequestPayment}>결제 요청</Button>}
          {c.videoUrl && (
            <Button
              variant="ghost"
              onClick={() => window.open(c.videoUrl, '_blank', 'noopener,noreferrer')}
            >
              소개 영상
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}
