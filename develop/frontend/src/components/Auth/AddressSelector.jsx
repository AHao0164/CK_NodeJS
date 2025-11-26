import React, { useState, useEffect, useMemo } from 'react';
import { vietnamProvinces } from '../../constants/vietnamLocations';

const AddressSelector = ({ value = {}, onChange, required = false, className = '' }) => {
  const [province, setProvince] = useState(value.province || '');
  const [ward, setWard] = useState(value.ward || '');
  const [addressDetail, setAddressDetail] = useState(value.addressDetail || '');
  
  // Search states
  const [provinceSearch, setProvinceSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');
  const [showProvinceDropdown, setShowProvinceDropdown] = useState(false);
  const [showWardDropdown, setShowWardDropdown] = useState(false);

  const provinces = Object.keys(vietnamProvinces);
  const wards = province ? vietnamProvinces[province] || [] : [];
  
  // Filtered lists based on search
  const filteredProvinces = useMemo(() => {
    if (!provinceSearch) return provinces;
    return provinces.filter(p => 
      p.toLowerCase().includes(provinceSearch.toLowerCase())
    );
  }, [provinceSearch, provinces]);
  
  const filteredWards = useMemo(() => {
    if (!wardSearch) return wards;
    return wards.filter(w => 
      w.toLowerCase().includes(wardSearch.toLowerCase())
    );
  }, [wardSearch, wards]);

  useEffect(() => {
    // Notify parent component of changes
    onChange({
      province,
      ward,
      addressDetail
    });
  }, [province, ward, addressDetail]);

  const handleProvinceSelect = (selectedProvince) => {
    setProvince(selectedProvince);
    setProvinceSearch(selectedProvince);
    setWard('');
    setWardSearch('');
    setShowProvinceDropdown(false);
  };

  const handleWardSelect = (selectedWard) => {
    setWard(selectedWard);
    setWardSearch(selectedWard);
    setShowWardDropdown(false);
  };

  const handleAddressDetailChange = (e) => {
    setAddressDetail(e.target.value);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Province/City with Search */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tỉnh/Thành phố {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={provinceSearch}
          onChange={(e) => {
            setProvinceSearch(e.target.value);
            setShowProvinceDropdown(true);
          }}
          onFocus={() => setShowProvinceDropdown(true)}
          placeholder="Tìm kiếm hoặc chọn tỉnh/thành phố..."
          required={required}
          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg 
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent 
                   dark:bg-gray-700 dark:text-white transition-all"
        />
        {showProvinceDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredProvinces.length > 0 ? (
              filteredProvinces.map((p) => (
                <div
                  key={p}
                  onClick={() => handleProvinceSelect(p)}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm"
                >
                  {p}
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">Không tìm thấy</div>
            )}
          </div>
        )}
      </div>

      {/* Ward with Search */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Phường/Xã {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={wardSearch}
          onChange={(e) => {
            setWardSearch(e.target.value);
            setShowWardDropdown(true);
          }}
          onFocus={() => setShowWardDropdown(true)}
          disabled={!province}
          placeholder="Tìm kiếm hoặc chọn phường/xã..."
          required={required}
          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg 
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent 
                   dark:bg-gray-700 dark:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {showWardDropdown && province && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredWards.length > 0 ? (
              filteredWards.map((w) => (
                <div
                  key={w}
                  onClick={() => handleWardSelect(w)}
                  className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-sm"
                >
                  {w}
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-gray-500">Không tìm thấy</div>
            )}
          </div>
        )}
      </div>

      {/* Detailed Address */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Địa chỉ chi tiết {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={addressDetail}
          onChange={handleAddressDetailChange}
          required={required}
          placeholder="Số nhà, tên đường..."
          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg 
                   focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent 
                   dark:bg-gray-700 dark:text-white transition-all"
        />
      </div>

      {/* Full Address Preview */}
      {(addressDetail || ward || province) && (
        <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">
            <strong>Địa chỉ đầy đủ:</strong>
          </p>
          <p className="text-xs text-gray-800 dark:text-gray-200">
            {[addressDetail, ward, province].filter(Boolean).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
};

export default AddressSelector;
