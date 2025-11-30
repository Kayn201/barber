import * as forge from "node-forge"
import * as archiver from "archiver"
import * as fs from "fs"
import * as path from "path"
import { Readable } from "stream"

const PASS_TYPE_IDENTIFIER = "pass.teste.popupsystem.com.br"
const TEAM_IDENTIFIER = "7ZB2L2RLB2"

interface BookingData {
  id: string
  service: {
    name: string
  }
  professional: {
    name: string
  }
  date: Date
  status: string
  barbershop?: {
    name: string
    address: string
    phones: string[]
  }
}

interface PassData {
  booking: BookingData
  webServiceURL: string
  authenticationToken: string
}

export async function generateWalletPass(
  passData: PassData,
  certificatesPathInput: string
): Promise<Buffer> {
  const { booking, webServiceURL, authenticationToken } = passData

  // Resolver caminho dos certificados (pode ser relativo ou absoluto)
  const certificatesPath = path.isAbsolute(certificatesPathInput)
    ? certificatesPathInput
    : path.join(process.cwd(), certificatesPathInput)

  // Criar diretório temporário para o .pass
  const tempDir = path.join(process.cwd(), "tmp", `pass-${booking.id}`)
  const passDir = path.join(tempDir, "agendamento.pass")

  // Garantir que o diretório existe
  if (!fs.existsSync(passDir)) {
    fs.mkdirSync(passDir, { recursive: true })
  }

  // Ler o template do pass.json
  const templatePath = path.join(
    process.cwd(),
    "wallet",
    "pass-templates",
    "pass.json"
  )
  const template = JSON.parse(fs.readFileSync(templatePath, "utf-8"))

  // Formatar data e horário
  const bookingDate = new Date(booking.date)
  const dateStr = bookingDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const timeStr = bookingDate.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })

  // Preencher o pass.json com os dados do booking
  const passJson = {
    ...template,
    serialNumber: booking.id,
    webServiceURL,
    authenticationToken,
    eventTicket: {
      ...template.eventTicket,
      headerFields: [
        {
          key: "service",
          label: "SERVIÇO",
          value: booking.service.name,
        },
      ],
      primaryFields: [
        {
          key: "date",
          label: "DATA",
          value: dateStr,
        },
      ],
      secondaryFields: [
        {
          key: "professional",
          label: "PROFISSIONAL",
          value: booking.professional.name,
        },
        {
          key: "time",
          label: "HORÁRIO",
          value: timeStr,
        },
      ],
      auxiliaryFields: [
        {
          key: "status",
          label: "STATUS",
          value: booking.status === "confirmed" ? "Confirmado" : booking.status,
        },
      ],
      backFields: [
        {
          key: "barbershop",
          label: "BARBEARIA",
          value: booking.barbershop?.name || "Barbearia",
        },
        {
          key: "address",
          label: "ENDEREÇO",
          value: booking.barbershop?.address || "",
        },
        {
          key: "phone",
          label: "TELEFONE",
          value: booking.barbershop?.phones?.[0] || "",
        },
        {
          key: "notes",
          label: "OBSERVAÇÕES",
          value: "Apresente este passe na barbearia no horário agendado.",
        },
      ],
    },
    barcode: {
      message: booking.id,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
    },
  }

  // Salvar pass.json
  fs.writeFileSync(
    path.join(passDir, "pass.json"),
    JSON.stringify(passJson, null, 2)
  )

  // Copiar ícones (se existirem)
  const iconPaths = [
    { src: "icon.png", dest: "icon.png" },
    { src: "icon@2x.png", dest: "icon@2x.png" },
    { src: "logo.png", dest: "logo.png" },
    { src: "logo@2x.png", dest: "logo@2x.png" },
  ]

  const publicPath = path.join(process.cwd(), "public")
  const logoPath = path.join(publicPath, "logo.png")

  // Se existir logo.png, usar como ícone
  if (fs.existsSync(logoPath)) {
    // Copiar logo como icon e logo
    const logoBuffer = fs.readFileSync(logoPath)
    fs.writeFileSync(path.join(passDir, "icon.png"), logoBuffer)
    fs.writeFileSync(path.join(passDir, "icon@2x.png"), logoBuffer)
    fs.writeFileSync(path.join(passDir, "logo.png"), logoBuffer)
    fs.writeFileSync(path.join(passDir, "logo@2x.png"), logoBuffer)
  }

  // Assinar o manifest
  const manifest: Record<string, string> = {}
  const files = fs.readdirSync(passDir)

  for (const file of files) {
    const filePath = path.join(passDir, file)
    const fileContent = fs.readFileSync(filePath)
    const hash = forge.md.sha1.create().update(fileContent.toString("binary"))
    manifest[file] = hash.digest().toHex()
  }

  fs.writeFileSync(
    path.join(passDir, "manifest.json"),
    JSON.stringify(manifest)
  )

  // Ler certificados - aceitar diferentes nomes
  const possibleCertNames = [
    "pass-cert.p12",
    "pass_cert_teste.p12",
    "pass-cert.p12",
  ]
  
  let certPath: string | null = null
  for (const name of possibleCertNames) {
    const testPath = path.join(certificatesPath, name)
    if (fs.existsSync(testPath)) {
      certPath = testPath
      break
    }
  }

  const wwdrPath = path.join(certificatesPath, "wwdr.pem")
  const wwdrAltPath = path.join(
    certificatesPath,
    "Apple Worldwide Developer Relations Certification Authority.pem"
  )

  // Verificar se os certificados existem
  if (!certPath) {
    throw new Error(
      `Certificado P12 não encontrado. Procure por: ${possibleCertNames.join(", ")} em: ${certificatesPath}`
    )
  }

  const wwdrExists = fs.existsSync(wwdrPath) || fs.existsSync(wwdrAltPath)
  if (!wwdrExists) {
    throw new Error(
      `Certificado WWDR não encontrado. Procure por wwdr.pem ou Apple Worldwide Developer Relations Certification Authority.pem em: ${certificatesPath}`
    )
  }

  // Ler e processar certificado P12
  // Nota: Para produção, você precisará fornecer a senha do P12
  const p12Password = process.env.WALLET_P12_PASSWORD || ""
  const p12Buffer = fs.readFileSync(certPath)

  let privateKey: forge.pki.PrivateKey | null = null
  let certificate: forge.pki.Certificate | null = null

  try {
    const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"))
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, p12Password)

    // Extrair chave privada
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    const keyBag = keyBags?.[forge.pki.oids.pkcs8ShroudedKeyBag]
    if (keyBag && keyBag[0] && keyBag[0].key) {
      privateKey = keyBag[0].key as any as forge.pki.PrivateKey
    }

    // Extrair certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
    const certBag = certBags?.[forge.pki.oids.certBag]
    if (certBag && certBag[0]) {
      certificate = certBag[0].cert as forge.pki.Certificate
    }
  } catch (error) {
    throw new Error(
      `Erro ao processar certificado P12: ${error}. Verifique se a senha está correta (WALLET_P12_PASSWORD)`
    )
  }

  if (!privateKey || !certificate) {
    throw new Error("Não foi possível extrair chave privada ou certificado do P12")
  }

  // Assinar manifest.json
  const manifestContent = fs.readFileSync(
    path.join(passDir, "manifest.json"),
    "utf-8"
  )

  const sign = forge.pkcs7.createSignedData()
  sign.content = forge.util.createBuffer(manifestContent, "utf8")
  sign.addCertificate(certificate)
  
  // Type assertion necessário devido a incompatibilidade de tipos do node-forge
  const signerKey = privateKey as any
  const signerCert = certificate as any
  sign.addSigner({
    key: signerKey,
    certificate: signerCert,
    digestAlgorithm: forge.pki.oids.sha1,
  })
  sign.sign({ detached: true })

  // Salvar assinatura
  const signature = forge.asn1.toDer(sign.toAsn1()).getBytes()
  fs.writeFileSync(path.join(passDir, "signature"), signature, "binary")

  // Criar arquivo .pkpass (ZIP)
  const archive = archiver.create("zip", { zlib: { level: 9 } })
  const chunks: Buffer[] = []

  archive.on("data", (chunk: Buffer) => {
    chunks.push(chunk)
  })

  archive.directory(passDir, false)
  await archive.finalize()

  // Aguardar todos os chunks
  return new Promise((resolve, reject) => {
    archive.on("end", () => {
      const buffer = Buffer.concat(chunks)

      // Limpar diretório temporário
      fs.rmSync(tempDir, { recursive: true, force: true })

      resolve(buffer)
    })

    archive.on("error", (err) => {
      // Limpar diretório temporário em caso de erro
      fs.rmSync(tempDir, { recursive: true, force: true })
      reject(err)
    })
  })
}

