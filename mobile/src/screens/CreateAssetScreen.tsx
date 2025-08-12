import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text, TextInput, Button } from '../components/Themed';
import { useCreateAsset } from '../api/assets';

const schema = z.object({
  assetBarcode: z.string().min(1),
  assetType: z.string().min(1),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DECOMMISSIONED']).default('ACTIVE'),
  wing: z.string().optional(),
  roomName: z.string().optional(),
  notes: z.string().optional()
});

type FormValues = z.infer<typeof schema>;

export default function CreateAssetScreen() {
  const navigation = useNavigation<any>();
  const createMutation = useCreateAsset();
  const { control, handleSubmit, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { assetBarcode: '', assetType: '', status: 'ACTIVE', wing: '', roomName: '', notes: '' }
  });

  const [scanning, setScanning] = useState(false);

  function startScan() {
    navigation.navigate('BarcodeScanner', {
      onScanned: (code: string) => {
        setValue('assetBarcode', code);
        setScanning(false);
      }
    });
    setScanning(true);
  }

  async function onSubmit(values: FormValues) {
    try {
      await createMutation.mutateAsync({ ...values, filterNeeded: false, filtersOn: false, augmentedCare: false });
      Alert.alert('Created', 'Asset created successfully');
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e) {
      Alert.alert('Error', 'Failed to create asset');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text>Asset Barcode</Text>
        <Controller name="assetBarcode" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="Scan or enter barcode" />
        )} />
        <Button title={scanning ? 'Scanning...' : 'Scan Barcode'} onPress={startScan} />

        <Text>Asset Type</Text>
        <Controller name="assetType" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="Asset Type" />
        )} />

        <Text>Status</Text>
        <Controller name="status" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="ACTIVE/INACTIVE/MAINTENANCE/DECOMMISSIONED" />
        )} />

        <Text>Wing</Text>
        <Controller name="wing" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="Wing" />
        )} />

        <Text>Room Name</Text>
        <Controller name="roomName" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="Room Name" />
        )} />

        <Text>Notes</Text>
        <Controller name="notes" control={control} render={({ field: { onChange, value } }) => (
          <TextInput value={value} onChangeText={onChange} placeholder="Notes" />
        )} />

        <Button title="Create" onPress={handleSubmit(onSubmit)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
