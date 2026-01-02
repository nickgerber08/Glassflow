import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useJobStore } from '../../stores/jobStore';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

// Default technicians list - must match create-job.tsx
const DEFAULT_TECHNICIANS = [
  { name: 'Iman', user_id: 'default_iman' },
  { name: 'Enrique', user_id: 'default_enrique' },
  { name: 'Alan', user_id: 'default_alan' },
];

interface Distributor {
  distributor_id: string;
  name: string;
  created_at: string;
}

interface PartJob {
  job_id: string;
  customer_name: string;
  part_number: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  distributor: string | null;
  pickup_tech: string | null;
  pickup_tech_name: string | null;
  status: string;
  assigned_to_name?: string;
}

interface DailyPartsData {
  date: string;
  total_parts: number;
  total_jobs: number;
  distributor_count: number;
  by_distributor: {
    distributor_id: string;
    distributor_name: string;
    parts: PartJob[];
  }[];
  unassigned: PartJob[];
}

export default function PartsScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const { setSelectedJob } = useJobStore();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [partsData, setPartsData] = useState<DailyPartsData | null>(null);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['unassigned']));
  const [allTechnicians, setAllTechnicians] = useState<any[]>(DEFAULT_TECHNICIANS);
  const [techFilters, setTechFilters] = useState<{ [sectionId: string]: string }>({});
  const [showTechFilterDropdown, setShowTechFilterDropdown] = useState<string | null>(null);
  
  // Modal states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDistributorModal, setShowDistributorModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTechPickerModal, setShowTechPickerModal] = useState(false);
  const [newDistributorName, setNewDistributorName] = useState('');
  const [selectedJobForAssign, setSelectedJobForAssign] = useState<PartJob | null>(null);
  const [selectedJobForTech, setSelectedJobForTech] = useState<PartJob | null>(null);

  const fetchDailyParts = useCallback(async () => {
    try {
      // Send date as YYYY-MM-DD to avoid timezone issues
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const response = await fetch(`${BACKEND_URL}/api/parts/daily?date=${dateStr}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPartsData(data);
      }
    } catch (error) {
      console.error('Error fetching parts:', error);
    }
  }, [selectedDate, sessionToken]);

  const fetchDistributors = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/distributors`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDistributors(data);
      }
    } catch (error) {
      console.error('Error fetching distributors:', error);
    }
  }, [sessionToken]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAllTechnicians([...DEFAULT_TECHNICIANS, ...data]);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [sessionToken]);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchDailyParts(), fetchDistributors(), fetchUsers()]);
    setLoading(false);
  }, [fetchDailyParts, fetchDistributors, fetchUsers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const addDistributor = async () => {
    if (!newDistributorName.trim()) {
      Alert.alert('Error', 'Please enter a distributor name');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/distributors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ name: newDistributorName.trim() }),
      });

      if (response.ok) {
        setNewDistributorName('');
        await fetchDistributors();
        Alert.alert('Success', 'Distributor added successfully');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.detail || 'Failed to add distributor');
      }
    } catch (error) {
      console.error('Error adding distributor:', error);
      Alert.alert('Error', 'Failed to add distributor');
    }
  };

  const deleteDistributor = async (distributorId: string, name: string) => {
    Alert.alert(
      'Delete Distributor',
      `Are you sure you want to delete "${name}"? Any parts assigned to this distributor will become unassigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${BACKEND_URL}/api/distributors/${distributorId}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${sessionToken}`,
                },
              });

              if (response.ok) {
                await loadData();
              } else {
                Alert.alert('Error', 'Failed to delete distributor');
              }
            } catch (error) {
              console.error('Error deleting distributor:', error);
            }
          },
        },
      ]
    );
  };

  const assignDistributor = async (distributorId: string) => {
    if (!selectedJobForAssign) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs/${selectedJobForAssign.job_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ distributor: distributorId }),
      });

      if (response.ok) {
        setShowAssignModal(false);
        setSelectedJobForAssign(null);
        await fetchDailyParts();
      } else {
        Alert.alert('Error', 'Failed to assign distributor');
      }
    } catch (error) {
      console.error('Error assigning distributor:', error);
      Alert.alert('Error', 'Failed to assign distributor');
    }
  };

  const openAssignModal = (job: PartJob) => {
    setSelectedJobForAssign(job);
    setShowAssignModal(true);
  };

  const openTechPicker = (job: PartJob) => {
    setSelectedJobForTech(job);
    setShowTechPickerModal(true);
  };

  const assignPickupTech = async (techId: string, techName: string) => {
    if (!selectedJobForTech) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/jobs/${selectedJobForTech.job_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ 
          pickup_tech: techId || null,
          pickup_tech_name: techName || null
        }),
      });

      if (response.ok) {
        setShowTechPickerModal(false);
        setSelectedJobForTech(null);
        await fetchDailyParts();
      } else {
        Alert.alert('Error', 'Failed to assign pickup tech');
      }
    } catch (error) {
      console.error('Error assigning pickup tech:', error);
      Alert.alert('Error', 'Failed to assign pickup tech');
    }
  };

  const getTechInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get unique techs from a list of parts
  const getUniqueTechsFromParts = (parts: PartJob[]) => {
    const techMap = new Map<string, { id: string; name: string; count: number }>();
    parts.forEach((part) => {
      if (part.pickup_tech && part.pickup_tech_name) {
        const existing = techMap.get(part.pickup_tech);
        if (existing) {
          existing.count++;
        } else {
          techMap.set(part.pickup_tech, {
            id: part.pickup_tech,
            name: part.pickup_tech_name,
            count: 1,
          });
        }
      }
    });
    return Array.from(techMap.values());
  };

  // Filter parts by selected tech
  const filterPartsByTech = (parts: PartJob[], sectionId: string) => {
    const selectedTech = techFilters[sectionId];
    if (!selectedTech || selectedTech === 'all') {
      return parts;
    }
    return parts.filter((part) => part.pickup_tech === selectedTech);
  };

  // Set tech filter for a section
  const setTechFilter = (sectionId: string, techId: string) => {
    setTechFilters((prev) => ({ ...prev, [sectionId]: techId }));
    setShowTechFilterDropdown(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const renderPartItem = (job: PartJob) => (
    <View key={job.job_id} style={styles.partItem}>
      <TouchableOpacity 
        style={styles.partItemMain}
        onPress={() => openAssignModal(job)}
      >
        <Text style={styles.partNumber}>{job.part_number}</Text>
        <View style={styles.partDetails}>
          <Text style={styles.customerName}>{job.customer_name}</Text>
          <Text style={styles.vehicleInfo}>
            '{job.vehicle_year.slice(-2)} {job.vehicle_make} {job.vehicle_model}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={styles.partItemRight}>
        {/* Tech Name Label */}
        <TouchableOpacity 
          style={[
            styles.techLabel,
            job.pickup_tech_name ? styles.techLabelAssigned : styles.techLabelUnassigned
          ]}
          onPress={() => openTechPicker(job)}
        >
          <Text style={[
            styles.techLabelText,
            job.pickup_tech_name ? styles.techLabelTextAssigned : styles.techLabelTextUnassigned
          ]}>
            {job.pickup_tech_name || 'Assign'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDistributorSection = (
    title: string,
    sectionId: string,
    parts: PartJob[],
    icon: string,
    iconColor: string
  ) => {
    const isExpanded = expandedSections.has(sectionId);
    const uniqueTechs = getUniqueTechsFromParts(parts);
    const filteredParts = filterPartsByTech(parts, sectionId);
    const selectedTechFilter = techFilters[sectionId] || 'all';
    const selectedTechName = selectedTechFilter === 'all' 
      ? 'All' 
      : uniqueTechs.find(t => t.id === selectedTechFilter)?.name || 'All';
    
    return (
      <View key={sectionId} style={styles.distributorSection}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleSection(sectionId)}
        >
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name={icon as any} size={22} color={iconColor} />
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{parts.length}</Text>
            </View>
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={24}
            color="#666"
          />
        </TouchableOpacity>
        
        {isExpanded && (
          <View style={styles.sectionContent}>
            {/* Tech Filter Dropdown */}
            {parts.length > 0 && uniqueTechs.length > 0 && (
              <View style={styles.techFilterContainer}>
                <TouchableOpacity
                  style={styles.techFilterButton}
                  onPress={() => setShowTechFilterDropdown(
                    showTechFilterDropdown === sectionId ? null : sectionId
                  )}
                >
                  <Ionicons name="person" size={16} color="#2196F3" />
                  <Text style={styles.techFilterButtonText}>
                    {selectedTechName}
                    {selectedTechFilter !== 'all' && ` (${filteredParts.length})`}
                  </Text>
                  <Ionicons 
                    name={showTechFilterDropdown === sectionId ? 'chevron-up' : 'chevron-down'} 
                    size={16} 
                    color="#666" 
                  />
                </TouchableOpacity>

                {/* Dropdown Menu */}
                {showTechFilterDropdown === sectionId && (
                  <View style={styles.techFilterDropdown}>
                    <TouchableOpacity
                      style={[
                        styles.techFilterOption,
                        selectedTechFilter === 'all' && styles.techFilterOptionActive
                      ]}
                      onPress={() => setTechFilter(sectionId, 'all')}
                    >
                      <Text style={[
                        styles.techFilterOptionText,
                        selectedTechFilter === 'all' && styles.techFilterOptionTextActive
                      ]}>
                        All ({parts.length})
                      </Text>
                    </TouchableOpacity>
                    {uniqueTechs.map((tech) => (
                      <TouchableOpacity
                        key={tech.id}
                        style={[
                          styles.techFilterOption,
                          selectedTechFilter === tech.id && styles.techFilterOptionActive
                        ]}
                        onPress={() => setTechFilter(sectionId, tech.id)}
                      >
                        <Text style={[
                          styles.techFilterOptionText,
                          selectedTechFilter === tech.id && styles.techFilterOptionTextActive
                        ]}>
                          {tech.name} ({tech.count})
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}

            {filteredParts.length === 0 ? (
              <Text style={styles.emptyText}>
                {parts.length > 0 ? 'No parts for this tech' : 'No parts'}
              </Text>
            ) : (
              filteredParts.map(renderPartItem)
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📦 Parts</Text>
        <TouchableOpacity
          style={styles.manageBtn}
          onPress={() => setShowDistributorModal(true)}
        >
          <Ionicons name="settings-outline" size={22} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
          <Ionicons name="chevron-back" size={28} color="#2196F3" />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={goToToday} style={styles.dateDisplay}>
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          {isToday(selectedDate) && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>Today</Text>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => changeDate(1)} style={styles.dateArrow}>
          <Ionicons name="chevron-forward" size={28} color="#2196F3" />
        </TouchableOpacity>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{partsData?.total_parts || 0}</Text>
          <Text style={styles.summaryLabel}>Parts</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{partsData?.total_jobs || 0}</Text>
          <Text style={styles.summaryLabel}>Jobs</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{partsData?.distributor_count || 0}</Text>
          <Text style={styles.summaryLabel}>Stops</Text>
        </View>
      </View>

      {/* Parts List */}
      <ScrollView
        style={styles.partsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Distributor Sections */}
        {partsData?.by_distributor.map((group) =>
          renderDistributorSection(
            group.distributor_name,
            group.distributor_id,
            group.parts,
            'storefront',
            '#4CAF50'
          )
        )}

        {/* Unassigned Section */}
        {renderDistributorSection(
          'Unassigned',
          'unassigned',
          partsData?.unassigned || [],
          'alert-circle',
          '#FF9800'
        )}

        {/* Empty State */}
        {partsData?.total_parts === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No Parts Needed</Text>
            <Text style={styles.emptyStateSubtitle}>
              No jobs with parts scheduled for this day
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Manage Distributors Modal */}
      <Modal
        visible={showDistributorModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDistributorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Distributors</Text>
              <TouchableOpacity onPress={() => setShowDistributorModal(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Add New Distributor */}
            <View style={styles.addDistributorSection}>
              <TextInput
                style={styles.distributorInput}
                value={newDistributorName}
                onChangeText={setNewDistributorName}
                placeholder="Enter distributor name"
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={styles.addDistributorBtn}
                onPress={addDistributor}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Distributor List */}
            <ScrollView style={styles.distributorList}>
              {distributors.length === 0 ? (
                <View style={styles.emptyDistributors}>
                  <Ionicons name="storefront-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyDistributorsText}>
                    No distributors yet
                  </Text>
                  <Text style={styles.emptyDistributorsSubtext}>
                    Add distributors above
                  </Text>
                </View>
              ) : (
                distributors.map((dist) => (
                  <View key={dist.distributor_id} style={styles.distributorItem}>
                    <View style={styles.distributorItemLeft}>
                      <Ionicons name="storefront" size={20} color="#4CAF50" />
                      <Text style={styles.distributorItemName}>{dist.name}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteDistributor(dist.distributor_id, dist.name)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={20} color="#F44336" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Assign Distributor Modal */}
      <Modal
        visible={showAssignModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.assignModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Distributor</Text>
              <TouchableOpacity onPress={() => setShowAssignModal(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedJobForAssign && (
              <View style={styles.selectedPartInfo}>
                <Text style={styles.selectedPartNumber}>
                  {selectedJobForAssign.part_number}
                </Text>
                <Text style={styles.selectedPartCustomer}>
                  {selectedJobForAssign.customer_name}
                </Text>
              </View>
            )}

            <ScrollView style={styles.assignDistributorList}>
              {/* Unassign Option */}
              <TouchableOpacity
                style={styles.assignOption}
                onPress={() => assignDistributor('')}
              >
                <Ionicons name="close-circle-outline" size={24} color="#999" />
                <Text style={styles.assignOptionText}>Unassign (Remove distributor)</Text>
              </TouchableOpacity>

              {distributors.map((dist) => (
                <TouchableOpacity
                  key={dist.distributor_id}
                  style={[
                    styles.assignOption,
                    selectedJobForAssign?.distributor === dist.distributor_id &&
                      styles.assignOptionActive,
                  ]}
                  onPress={() => assignDistributor(dist.distributor_id)}
                >
                  <Ionicons
                    name="storefront"
                    size={24}
                    color={
                      selectedJobForAssign?.distributor === dist.distributor_id
                        ? '#fff'
                        : '#4CAF50'
                    }
                  />
                  <Text
                    style={[
                      styles.assignOptionText,
                      selectedJobForAssign?.distributor === dist.distributor_id &&
                        styles.assignOptionTextActive,
                    ]}
                  >
                    {dist.name}
                  </Text>
                </TouchableOpacity>
              ))}

              {distributors.length === 0 && (
                <View style={styles.noDistributorsWarning}>
                  <Ionicons name="alert-circle" size={32} color="#FF9800" />
                  <Text style={styles.noDistributorsText}>
                    No distributors available
                  </Text>
                  <TouchableOpacity
                    style={styles.addFirstDistributorBtn}
                    onPress={() => {
                      setShowAssignModal(false);
                      setShowDistributorModal(true);
                    }}
                  >
                    <Text style={styles.addFirstDistributorText}>
                      Add Distributors
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Tech Picker Modal */}
      <Modal
        visible={showTechPickerModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTechPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.techPickerModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Pickup Tech</Text>
              <TouchableOpacity onPress={() => setShowTechPickerModal(false)}>
                <Ionicons name="close-circle" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {selectedJobForTech && (
              <View style={styles.selectedPartInfo}>
                <Text style={styles.selectedPartNumber}>
                  {selectedJobForTech.part_number}
                </Text>
                <Text style={styles.selectedPartCustomer}>
                  {selectedJobForTech.customer_name}
                </Text>
                {selectedJobForTech.pickup_tech_name && (
                  <Text style={styles.currentTechLabel}>
                    Current: {selectedJobForTech.pickup_tech_name}
                  </Text>
                )}
              </View>
            )}

            <ScrollView style={styles.techPickerList}>
              {/* Unassign Option */}
              <TouchableOpacity
                style={styles.techOption}
                onPress={() => assignPickupTech('', '')}
              >
                <View style={styles.techOptionBadgeUnassigned}>
                  <Ionicons name="close" size={16} color="#999" />
                </View>
                <Text style={styles.techOptionText}>Unassign (No tech)</Text>
              </TouchableOpacity>

              {allTechnicians.map((tech) => (
                <TouchableOpacity
                  key={tech.user_id}
                  style={[
                    styles.techOption,
                    selectedJobForTech?.pickup_tech === tech.user_id && styles.techOptionActive,
                  ]}
                  onPress={() => assignPickupTech(tech.user_id, tech.name)}
                >
                  <View
                    style={[
                      styles.techOptionBadge,
                      selectedJobForTech?.pickup_tech === tech.user_id && styles.techOptionBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.techOptionBadgeText,
                        selectedJobForTech?.pickup_tech === tech.user_id && styles.techOptionBadgeTextActive,
                      ]}
                    >
                      {getTechInitials(tech.name)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.techOptionText,
                      selectedJobForTech?.pickup_tech === tech.user_id && styles.techOptionTextActive,
                    ]}
                  >
                    {tech.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  manageBtn: {
    padding: 8,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  dateArrow: {
    padding: 8,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  todayBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  todayBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2196F3',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 4,
  },
  partsList: {
    flex: 1,
    marginTop: 16,
    paddingHorizontal: 16,
  },
  distributorSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fafafa',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  countBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  partItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  partItemMain: {
    flex: 1,
  },
  partNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF9800',
    marginBottom: 4,
  },
  partDetails: {
    flexDirection: 'row',
    gap: 8,
  },
  customerName: {
    fontSize: 14,
    color: '#333',
  },
  vehicleInfo: {
    fontSize: 14,
    color: '#666',
  },
  assignBtn: {
    padding: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  addDistributorSection: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  distributorInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  addDistributorBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distributorList: {
    paddingHorizontal: 20,
    maxHeight: 300,
  },
  distributorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  distributorItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  distributorItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  deleteBtn: {
    padding: 8,
  },
  emptyDistributors: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyDistributorsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptyDistributorsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  // Assign Modal styles
  assignModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  selectedPartInfo: {
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFF3E0',
    marginHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
  },
  selectedPartNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FF9800',
  },
  selectedPartCustomer: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  assignDistributorList: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  assignOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  assignOptionActive: {
    backgroundColor: '#4CAF50',
  },
  assignOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  assignOptionTextActive: {
    color: '#fff',
  },
  noDistributorsWarning: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noDistributorsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  addFirstDistributorBtn: {
    backgroundColor: '#2196F3',
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
  },
  addFirstDistributorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Part item right side styles
  partItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Tech Label styles (text-based, not badge)
  techLabel: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  techLabelAssigned: {
    backgroundColor: '#E3F2FD',
  },
  techLabelUnassigned: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  techLabelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  techLabelTextAssigned: {
    color: '#1976D2',
  },
  techLabelTextUnassigned: {
    color: '#999',
  },
  // Tech Filter styles
  techFilterContainer: {
    marginBottom: 12,
    position: 'relative',
    zIndex: 100,
  },
  techFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  techFilterButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  techFilterDropdown: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  techFilterOption: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  techFilterOptionActive: {
    backgroundColor: '#E3F2FD',
  },
  techFilterOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  techFilterOptionTextActive: {
    color: '#1976D2',
    fontWeight: '600',
  },
  // Tech Picker Modal styles
  techPickerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  currentTechLabel: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 6,
    fontWeight: '500',
  },
  techPickerList: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  techOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 14,
  },
  techOptionActive: {
    backgroundColor: '#2196F3',
  },
  techOptionBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  techOptionBadgeActive: {
    backgroundColor: '#1976D2',
  },
  techOptionBadgeUnassigned: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  techOptionBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2196F3',
  },
  techOptionBadgeTextActive: {
    color: '#fff',
  },
  techOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  techOptionTextActive: {
    color: '#fff',
  },
});
