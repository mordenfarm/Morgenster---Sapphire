import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';
import { Search, Plus, FileText, Download, Printer } from 'lucide-react';

interface Document {
  id: string;
  name: string;
}

const mockDocuments: Document[] = [
  { id: 'med-exam', name: 'Medical Examination Form' },
  { id: 'med-cert', name: 'Medical Certificate' },
  { id: 'consent', name: 'Consent Form' },
];

const StationariesPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  const canAddDocuments = userProfile?.role === Role.Admin;

  const filteredDocuments = useMemo(() => {
    if (!searchQuery) return mockDocuments;
    return mockDocuments.filter(doc =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const generateAndPrintDocument = (docName: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${docName}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 40px; }
              .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 30px; }
              .header h1 { margin: 0; font-size: 24px; }
              .header p { margin: 4px 0; }
              .content { border: 1px solid #ccc; padding: 20px; text-align: center; }
              h2 { font-size: 20px; }
              p { line-height: 1.6; }
              @media print {
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>RCZ MORGENSTER HOSPITAL</h1>
              <p>Morgenster Mission, Masvingo, Zimbabwe</p>
            </div>
            <h2>${docName}</h2>
            <div class="content">
              <p>This part is waiting for you to get the Firebase Storage.</p>
              <p><strong>BLACKGIFT TECH LABS</strong> and <strong>AlfaOctal Systems</strong> is working on it.</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <div className="stationaries-page-container">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-white">Stationaries</h1>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="document-search-bar"
            />
          </div>
          {canAddDocuments && (
            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500">
              <Plus size={18} />
              <span className="hidden sm:inline">Add Document</span>
            </button>
          )}
        </div>
      </div>

      <div className="document-grid">
        {filteredDocuments.map(doc => (
          <div key={doc.id} className="document-card">
            <div className="document-card-icon">
              <FileText size={48} className="text-sky-400" />
            </div>
            <h3 className="document-card-title">{doc.name}</h3>
            <div className="document-card-actions">
              <button
                onClick={() => generateAndPrintDocument(doc.name)}
                className="document-card-button download"
              >
                <Download size={16} />
                Download
              </button>
              <button
                onClick={() => generateAndPrintDocument(doc.name)}
                className="document-card-button print"
              >
                <Printer size={16} />
                Print
              </button>
            </div>
          </div>
        ))}
      </div>
       {filteredDocuments.length === 0 && (
          <div className="text-center py-12 bg-[#161B22] border border-gray-700 rounded-lg col-span-full mt-8">
            <p className="text-gray-400">No documents found matching your search.</p>
          </div>
        )}
    </div>
  );
};

export default StationariesPage;
