import { useState, useRef } from 'react'
import ContaCaptUpload from '../components/ContaCapt/ContaCaptUpload'
import ContaCaptPreview from '../components/ContaCapt/ContaCaptPreview'

export default function ContaCaptPage() {
  const [previewData, setPreviewData] = useState([])
  const [showPreview, setShowPreview] = useState(false)

  const handleShowPreview = (data) => {
    setPreviewData(data)
    setShowPreview(true)
  }

  const handleCancelPreview = () => {
    setShowPreview(false)
    setPreviewData([])
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Importar Conta Capt</h1>
        <p className="text-sm text-[#666666] mt-1">Importe dados de boletos diretamente do arquivo de gestão da Capt Capital</p>
      </div>

      {/* Upload Area */}
      <ContaCaptUpload onShowPreview={handleShowPreview} />

      {/* Preview Modal */}
      {showPreview && previewData.length > 0 && (
        <ContaCaptPreview
          previewData={previewData}
          onCancel={handleCancelPreview}
        />
      )}
    </div>
  )
}
