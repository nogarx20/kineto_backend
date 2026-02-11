
import { Request, Response } from 'express';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { generateUUID } from '../../utils/uuid';
import path from 'path';

// Configuración de AWS desde variables de entorno
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

export class FilesController {
  async upload(req: Request, res: Response) {
    try {
      const file = (req as any).file;
      if (!file) {
        return (res as any).status(400).json({ error: 'No se ha proporcionado ningún archivo' });
      }

      const user = (req as any).user;
      const bucketName = process.env.AWS_S3_BUCKET_NAME || 'asistenza-pro-files';
      const fileExtension = path.extname(file.originalname);
      const fileName = `photos/${user.company_id}/${generateUUID()}${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        // ACL: 'public-read' // Depende de la configuración del bucket, hoy en día se suele manejar vía políticas
      });

      // Fix: Cast s3Client to any as the 'send' property is reported as missing on the S3Client type in this environment.
      await (s3Client as any).send(command);

      // Componer la URL pública (Considerando un bucket público o con CloudFront)
      const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`;

      (res as any).json({ 
        url: publicUrl,
        fileName: fileName 
      });
    } catch (err: any) {
      console.error('S3 Upload Error:', err);
      (res as any).status(500).json({ error: 'Error al subir el archivo al almacenamiento en la nube' });
    }
  }
}
