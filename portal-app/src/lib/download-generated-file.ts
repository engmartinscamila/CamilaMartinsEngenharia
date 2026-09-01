import * as FileSystem from 'expo-file-system/legacy';
import { Linking, Platform } from 'react-native';

const safeName = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 160) || 'documento.docx';

export async function downloadBase64File(contentBase64: string, fileName: string, mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
  const name = safeName(fileName);
  if (Platform.OS === 'web') {
    const binary = atob(contentBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }

  if (!FileSystem.cacheDirectory) throw new Error('Armazenamento temporário indisponível neste dispositivo.');
  const uri = `${FileSystem.cacheDirectory}${Date.now()}-${name}`;
  await FileSystem.writeAsStringAsync(uri, contentBase64, { encoding: FileSystem.EncodingType.Base64 });
  const openUri = Platform.OS === 'android' ? await FileSystem.getContentUriAsync(uri) : uri;
  const supported = await Linking.canOpenURL(openUri);
  if (!supported) throw new Error('O Word foi gerado, mas o dispositivo não encontrou um aplicativo para abri-lo.');
  await Linking.openURL(openUri);
}
