import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const imageType = formData.get("imageType") as string || "service" // service, professional, business

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
    }

    // Validar tipo de arquivo
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"]
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Tipo de arquivo inválido. Use JPG, PNG, WEBP ou GIF" },
        { status: 400 }
      )
    }

    // Validar tamanho (máximo 10MB para permitir imagens grandes)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "Arquivo muito grande. Tamanho máximo: 10MB" },
        { status: 400 }
      )
    }

    // Definir tamanhos máximos baseado no tipo
    const maxDimensions: { [key: string]: { width: number; height: number } } = {
      service: { width: 400, height: 400 },
      professional: { width: 200, height: 200 },
      business: { width: 400, height: 400 },
    }

    const dimensions = maxDimensions[imageType] || maxDimensions.service

    // Converter para buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Redimensionar imagem mantendo proporção e qualidade
    let processedBuffer = buffer
    let finalMimeType = file.type
    
    try {
      // Não processar GIFs animados
      if (file.type === "image/gif") {
        // Verificar se é GIF animado (simples: se sharp não conseguir processar, usar original)
        try {
          const image = sharp(buffer)
          const metadata = await image.metadata()
          
          // Se for maior que o tamanho máximo, redimensionar
          if (metadata.width && metadata.height && 
              (metadata.width > dimensions.width || metadata.height > dimensions.height)) {
            processedBuffer = await image
              .resize(dimensions.width, dimensions.height, {
                fit: "cover",
                position: "center",
              })
              .toBuffer()
          }
        } catch {
          // GIF animado ou erro, usar original
          processedBuffer = buffer
        }
      } else {
        // Para outros formatos, processar normalmente
        const image = sharp(buffer)
        const metadata = await image.metadata()

        // Só redimensiona se a imagem for maior que o tamanho máximo
        if (metadata.width && metadata.height && 
            (metadata.width > dimensions.width || metadata.height > dimensions.height)) {
          processedBuffer = await image
            .resize(dimensions.width, dimensions.height, {
              fit: "cover",
              position: "center",
            })
            .jpeg({ quality: 85 }) // Converter para JPEG com qualidade 85% para reduzir tamanho
            .toBuffer()
          finalMimeType = "image/jpeg"
        }
      }
    } catch (sharpError) {
      // Se sharp falhar, usar imagem original
      console.warn("Erro ao processar imagem com sharp, usando original:", sharpError)
      processedBuffer = buffer
    }

    // Converter para base64
    const base64 = processedBuffer.toString("base64")
    const dataUrl = `data:${finalMimeType};base64,${base64}`

    return NextResponse.json({
      success: true,
      imageUrl: dataUrl,
    })
  } catch (error) {
    console.error("Erro ao fazer upload da imagem:", error)
    return NextResponse.json(
      { error: "Erro ao processar a imagem" },
      { status: 500 }
    )
  }
}

